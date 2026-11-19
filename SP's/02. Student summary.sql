-- 02. Dashboard_MyUni_StudentSummary: the headline numbers of the Overview tab, one row.
-- Students / DegreeCompleted: active students in the allowed degrees (the semester filter does not apply).
-- RegisteredStudents, NewAdmissions: for the chosen semester, or all semesters.
-- Billed, Received, Outstanding, Discounts: challans dated in the range (rules of Dashboard_MyUni_Receivables).
-- Overdue, Defaulters: as of @EndDate (today when empty), rules of Dashboard_MyUni_Defaulters.
-- Collected: receipts dated in the range (rules of Dashboard_MyUni_Collections).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_StudentSummary;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_StudentSummary
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @DepartmentId INT              = NULL,   -- NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL,   -- whole day included; NULL = no limit
    @RequireApproved BIT           = 1       -- 0 also counts pending fee receipts: only for a test database
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @From DATE = ISNULL(@StartDate, '19000101');
    DECLARE @To   DATE = DATEADD(DAY, 1, ISNULL(@EndDate, '99991230'));
    DECLARE @AsOf DATE = ISNULL(@EndDate, CAST(GETDATE() AS DATE));

    -- Deg: the degree programs the filters allow, with their department and faculty names.
    ;WITH Deg AS (
        SELECT UD.Id, UD.DegreeCode, UD.DegreeName, UD.Status, D.[Description] AS Department, FA.Faculty
        FROM UNIDegree UD WITH (NOLOCK)
        LEFT JOIN Departments D WITH (NOLOCK) ON D.Id = UD.DepartmentId
        OUTER APPLY (SELECT TOP 1 F.[Description] AS Faculty
                     FROM FacultyDetails FD WITH (NOLOCK)
                     JOIN Faculty F WITH (NOLOCK) ON F.FacultyGUID = FD.FacultyGUID
                     WHERE FD.DepartmentId = UD.DepartmentId
                     ORDER BY F.[Description]) FA
        WHERE UD.CompanyId = @CompanyId
          AND (@DegreeId IS NULL OR UD.Id = @DegreeId)
          AND (ISNULL(@DepartmentId, 0) = 0 OR UD.DepartmentId = @DepartmentId)
          AND (@FacultyId IS NULL OR EXISTS (SELECT 1 FROM FacultyDetails FD2 WITH (NOLOCK)
                                             WHERE FD2.DepartmentId = UD.DepartmentId AND FD2.FacultyGUID = @FacultyId))
    ),
    Ch AS (
        SELECT C.Id, C.StudentId, C.DegreeId, C.ChallanDescription,
               ISNULL(C.ValidityDate, C.DueDate) AS DueOn,
               ISNULL(C.NetChallanAmt, ISNULL(C.TotalAmount, 0) - ISNULL(C.TotalDiscountAmt, 0)) AS Net,
               ISNULL(C.TotalDiscountAmt, 0) + ISNULL(C.GovtFeeDiscountAmt, 0) AS Discount,
               CASE WHEN C.TransDate >= @From AND C.TransDate < @To THEN 1 ELSE 0 END AS InRange,
               CASE WHEN C.ParentIdGuid IS NULL AND C.ChallanStatus NOT IN (3, 40) THEN 1 ELSE 0 END AS IsBilled,
               CASE WHEN C.ChallanStatus IN (1, 62) THEN 1 ELSE 0 END AS IsPaid,
               CASE WHEN C.ParentIdGuid IS NULL AND C.ChallanStatus NOT IN (1, 62, 3, 40, 63, 64)
                         AND ISNULL(C.ValidityDate, C.DueDate) < @AsOf THEN 1 ELSE 0 END AS IsOverdue
        FROM UNIStudentsChallan C WITH (NOLOCK)
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = C.StudentId AND S.Status = 1
        JOIN Deg G ON G.Id = C.DegreeId
        WHERE C.CompanyId = @CompanyId
          AND C.Status = 1
          AND (ISNULL(@BranchId, 0) = 0 OR C.BranchId = @BranchId)
          AND (@SemesterId IS NULL OR C.RegisterInId = @SemesterId)
    ),
    -- Due: one row per student and degree; a defaulter has a balance and at least one overdue challan.
    Due AS (
        SELECT C.StudentId, C.DegreeId,
               SUM(C.IsBilled * C.Net) AS TotalFee,
               SUM(C.IsPaid * C.Net)   AS Received,
               SUM(C.IsOverdue)        AS UnpaidChallans,
               MIN(CASE WHEN C.IsOverdue = 1 THEN C.DueOn END) AS OldestDueDate
        FROM Ch C
        GROUP BY C.StudentId, C.DegreeId
        HAVING SUM(C.IsBilled * C.Net) - SUM(C.IsPaid * C.Net) > 0 AND SUM(C.IsOverdue) > 0
    ),
    Rec AS (
        SELECT ISNULL(SC.DegreeId, S.DegreeId) AS DegreeId, ISNULL(DT.Amount, ISNULL(FR.TotalAmount, 0)) AS Amount
        FROM AEOFeeReceipts FR WITH (NOLOCK)
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = FR.UNIStudentId AND S.Status = 1
        LEFT JOIN UNIStudentsChallan SC WITH (NOLOCK) ON SC.Id = FR.UNIChallanId
        OUTER APPLY (SELECT SUM(ISNULL(FRD.Amount, 0)) AS Amount
                     FROM AEOFeeReceiptsDetail FRD WITH (NOLOCK) WHERE FRD.FeeReceiptId = FR.Id) DT
        WHERE FR.CompanyId = @CompanyId
          AND FR.Status = 1
          AND (FR.FeeStatus = 19 OR (@RequireApproved = 0 AND FR.FeeStatus = 4))
          AND (ISNULL(@BranchId, 0) = 0 OR FR.BranchId = @BranchId)
          AND FR.TransDate >= @From AND FR.TransDate < @To
          AND (@SemesterId IS NULL OR SC.RegisterInId = @SemesterId)

        UNION ALL

        SELECT ISNULL(BRD.DegreeId, S.DegreeId), ISNULL(BRD.Amount, 0)
        FROM UNIBankReceiptsDetail BRD WITH (NOLOCK)
        JOIN UNIBankReceipts BR WITH (NOLOCK) ON BR.Id = BRD.BankReceiptId
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = BRD.StudentId AND S.Status = 1
        OUTER APPLY (SELECT TOP 1 C.RegisterInId
                     FROM UNIStudentsChallan C WITH (NOLOCK)
                     WHERE C.StudentId = BRD.StudentId AND C.ChallanNo = BRD.ChallanNo
                     ORDER BY C.TransDate DESC) SC
        WHERE BR.Status = 1
          AND BRD.DocStatus = 35
          AND BR.BankReceiptStatus IN (2, 34)
          AND (ISNULL(@BranchId, 0) = 0 OR BR.BranchId = @BranchId)
          AND BR.UploadedDate >= @From AND BR.UploadedDate < @To
          AND (@SemesterId IS NULL OR SC.RegisterInId = @SemesterId)
    )
    SELECT
        (SELECT COUNT(*) FROM UNIStudents S WITH (NOLOCK) JOIN Deg G ON G.Id = S.DegreeId
         WHERE S.Status = 1 AND (ISNULL(@BranchId, 0) = 0 OR S.BranchId = @BranchId)) AS Students,

        (SELECT COUNT(DISTINCT R.StudentsId)
         FROM UNIStudentsRegistrations R WITH (NOLOCK)
         JOIN UNIStudents S WITH (NOLOCK) ON S.Id = R.StudentsId AND S.Status = 1
         JOIN Deg G ON G.Id = R.DegreeId
         WHERE R.CompanyId = @CompanyId AND R.Status = 1
           AND (ISNULL(@BranchId, 0) = 0 OR R.BranchId = @BranchId)
           AND (@SemesterId IS NULL OR ISNULL(R.RegisterInId, R.SemesterSessionId) = @SemesterId)) AS RegisteredStudents,

        (SELECT COUNT(*) FROM UNIStudents S WITH (NOLOCK) JOIN Deg G ON G.Id = S.DegreeId
         WHERE S.Status = 1 AND S.IsDegreeCompleted = 1
           AND (ISNULL(@BranchId, 0) = 0 OR S.BranchId = @BranchId)) AS DegreeCompleted,

        (SELECT COUNT(*) FROM Deg G WHERE G.Status = 1) AS Programs,

        (SELECT COUNT(DISTINCT SA.StudentsId)
         FROM UNIStudentAnnounceDetails SA WITH (NOLOCK)
         JOIN UNIStudents S WITH (NOLOCK) ON S.Id = SA.StudentsId AND S.Status = 1
         JOIN Deg G ON G.Id = SA.DegreeId
         WHERE SA.Status = 1
           AND (ISNULL(@BranchId, 0) = 0 OR S.BranchId = @BranchId)
           AND (@SemesterId IS NULL OR SA.SemesterSessionId = @SemesterId)) AS NewAdmissions,

        ISNULL((SELECT SUM(C.IsBilled * C.Net) FROM Ch C WHERE C.InRange = 1), 0) AS Billed,
        ISNULL((SELECT SUM(C.IsPaid * C.Net)   FROM Ch C WHERE C.InRange = 1), 0) AS Received,
        ISNULL((SELECT SUM(C.IsBilled * C.Net) - SUM(C.IsPaid * C.Net) FROM Ch C WHERE C.InRange = 1), 0) AS Outstanding,
        ISNULL((SELECT SUM(C.Net) FROM Ch C WHERE C.IsOverdue = 1), 0) AS Overdue,
        (SELECT COUNT(DISTINCT D.StudentId) FROM Due D) AS Defaulters,
        ISNULL((SELECT SUM(C.IsBilled * C.Discount) FROM Ch C WHERE C.InRange = 1), 0) AS Discounts,
        ISNULL((SELECT SUM(R.Amount) FROM Rec R JOIN Deg G ON G.Id = R.DegreeId), 0) AS Collected;
END
GO

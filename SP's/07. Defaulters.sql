-- 07. Dashboard_MyUni_Defaulters: students with an overdue fee balance, one row per student and degree (Defaulters tab).
-- Rules of the ERP report UNIStudents_Rp_GetDefaulterData:
--   TotalFee = NetChallanAmt of main challans (ParentIdGuid empty) not expired / cancelled (ChallanStatus 3, 40)
--   Received = NetChallanAmt of paid challans (ChallanStatus 1, 62);  Balance = TotalFee - Received, must be above 0
--   and the student has a main challan still open (not 1, 62, 3, 40, 63, 64) whose validity date (else due date)
--   is before @EndDate (today when empty). @StartDate is not used.
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Defaulters;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Defaulters
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @DepartmentId INT              = NULL,   -- NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL    -- "as of" date; NULL = today
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @From DATE = '19000101';
    DECLARE @To   DATE = '99991231';
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
    )
    SELECT D.StudentId, S.AdmissionNumber AS RegNo, S.StudentFullName AS Student,
           G.DegreeCode, G.DegreeName AS Degree, G.Department, G.Faculty,
           PT.[Description] AS ProgramType,
           D.TotalFee, D.Received, D.TotalFee - D.Received AS Balance,
           D.UnpaidChallans, D.OldestDueDate,
           DATEDIFF(DAY, D.OldestDueDate, @AsOf) AS DaysOverdue,
           STUFF((SELECT ', ' + ISNULL(NULLIF(C.ChallanDescription, ''), 'Full fee')
                  FROM Ch C
                  WHERE C.StudentId = D.StudentId AND C.DegreeId = D.DegreeId AND C.IsOverdue = 1
                  ORDER BY C.DueOn
                  FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS Remarks
    FROM Due D
    JOIN UNIStudents S WITH (NOLOCK) ON S.Id = D.StudentId
    JOIN Deg G ON G.Id = D.DegreeId
    LEFT JOIN ProgramType PT WITH (NOLOCK) ON PT.Id = S.ShiftId
    ORDER BY D.TotalFee - D.Received DESC, S.StudentFullName;
END
GO

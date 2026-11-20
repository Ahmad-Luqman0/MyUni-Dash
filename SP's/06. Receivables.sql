-- 06. Dashboard_MyUni_Receivables: total challan, paid, unpaid and overdue per semester, degree and challan type (Receivables tab).
-- A challan is counted by its ChallanStatus alone (4 = open, 62 = paid), whether it is a full-fee or an installment challan:
--   Billed   (Total challan) = NetChallanAmt of challans that are open or paid (ChallanStatus 4, 62)
--   Received (Paid)          = NetChallanAmt of paid challans (ChallanStatus 62)
--   Overdue                  = open challans (ChallanStatus 4) whose validity date (else due date) has passed
-- Unpaid = Billed - Received = the open challans (ChallanStatus 4). The date range is on the challan date (TransDate).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Receivables;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Receivables
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @DepartmentId INT              = NULL,   -- NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL    -- whole day included; NULL = no limit
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @From  DATE = ISNULL(@StartDate, '19000101');
    DECLARE @To    DATE = DATEADD(DAY, 1, ISNULL(@EndDate, '99991230'));
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

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
        SELECT ISNULL(C.RegisterInId, C.SemesterSessionId) AS SemesterId, C.DegreeId, C.ChallanTypeId,
               ISNULL(C.NetChallanAmt, ISNULL(C.TotalAmount, 0) - ISNULL(C.TotalDiscountAmt, 0)) AS Net,
               ISNULL(C.TotalDiscountAmt, 0) + ISNULL(C.GovtFeeDiscountAmt, 0) AS Discount,
               ISNULL(C.FineAmount, 0) AS Fine,
               CASE WHEN C.ChallanStatus IN (4, 62) THEN 1 ELSE 0 END AS IsBilled,
               CASE WHEN C.ChallanStatus = 62 THEN 1 ELSE 0 END AS IsPaid,
               CASE WHEN C.ChallanStatus = 4
                         AND ISNULL(C.ValidityDate, C.DueDate) < @Today THEN 1 ELSE 0 END AS IsOverdue
        FROM UNIStudentsChallan C WITH (NOLOCK)
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = C.StudentId AND S.Status = 1
        WHERE C.CompanyId = @CompanyId
          AND C.Status = 1
          AND (ISNULL(@BranchId, 0) = 0 OR C.BranchId = @BranchId)
          AND (@SemesterId IS NULL OR C.RegisterInId = @SemesterId)
          AND C.TransDate >= @From AND C.TransDate < @To
          AND C.ChallanStatus IN (4, 62)   -- only open and paid challans are counted
    )
    SELECT SEM.Id AS SemesterId, SEM.Code AS Semester, SEM.StartDate AS SemesterStart,
           G.Id AS DegreeId, G.DegreeCode, G.DegreeName AS Degree, G.Department, G.Faculty,
           CT.ChallanType,
           SUM(C.IsBilled)                 AS Challans,
           SUM(C.IsBilled * C.Net)         AS Billed,
           SUM(C.IsPaid * C.Net)           AS Received,
           SUM(C.IsOverdue)                AS OverdueChallans,
           SUM(C.IsOverdue * C.Net)        AS Overdue,
           SUM(C.IsBilled * C.Discount)    AS Discount,
           SUM(C.IsBilled * C.Fine)        AS Fine
    FROM Ch C
    JOIN Deg G ON G.Id = C.DegreeId
    LEFT JOIN UNIAcademicYearSemesterDetails SEM WITH (NOLOCK) ON SEM.Id = C.SemesterId
    LEFT JOIN UNIChallanTypes CT ON CT.Id = C.ChallanTypeId
    GROUP BY SEM.Id, SEM.Code, SEM.StartDate, G.Id, G.DegreeCode, G.DegreeName, G.Department, G.Faculty, CT.ChallanType
    ORDER BY SEM.StartDate, G.DegreeName, CT.ChallanType
    OPTION (RECOMPILE);   -- plan for the filters actually chosen
END
GO

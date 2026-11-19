-- 13. Dashboard_MyUni_Installments: installment plans per month, degree, plan status and state (Installments tab).
-- One row of UNIFeeInstallmentsDetail is one installment. PlanStatus: Approved when the plan's InstallmentStatus = 2, else Pending.
-- State: Paid when its challan is paid (ChallanStatus 1, 62) or the installment itself is marked 1 / 62;
--        Overdue when its validity date (else its month) has passed; otherwise Upcoming.
-- The date range is on the installment month.
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Installments;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Installments
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
    Ins AS (
        SELECT DATEFROMPARTS(YEAR(D.[Month]), MONTH(D.[Month]), 1) AS [Month],
               S.DegreeId, H.Id AS PlanId, ISNULL(D.Amount, 0) AS Amount,
               CASE WHEN H.InstallmentStatus = 2 THEN 'Approved' ELSE 'Pending' END AS PlanStatus,
               CASE WHEN C.ChallanStatus IN (1, 62) OR D.InstallmentStatus IN (1, 62) THEN 'Paid'
                    WHEN ISNULL(D.ValidityDate, D.[Month]) < @Today THEN 'Overdue'
                    ELSE 'Upcoming' END AS [State]
        FROM UNIFeeInstallmentsDetail D WITH (NOLOCK)
        JOIN UNIFeeInstallments H WITH (NOLOCK) ON H.Id = D.FeeInstallmentId
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = H.StudentId AND S.Status = 1
        LEFT JOIN UNIStudentsChallan C WITH (NOLOCK) ON C.Id = D.ChallanGUID
        WHERE H.CompanyId = @CompanyId
          AND H.Status = 1 AND D.Status = 1
          AND D.[Month] IS NOT NULL
          AND (ISNULL(@BranchId, 0) = 0 OR H.BranchId = @BranchId)
          AND (@SemesterId IS NULL OR H.SemesterId = @SemesterId)
          AND D.[Month] >= @From AND D.[Month] < @To
    )
    SELECT I.[Month], G.Id AS DegreeId, G.DegreeCode, G.DegreeName AS Degree, G.Department, G.Faculty,
           I.PlanStatus, I.[State],
           COUNT(DISTINCT I.PlanId) AS Plans,
           COUNT(*)                 AS Installments,
           SUM(I.Amount)            AS Amount
    FROM Ins I
    JOIN Deg G ON G.Id = I.DegreeId
    GROUP BY I.[Month], G.Id, G.DegreeCode, G.DegreeName, G.Department, G.Faculty, I.PlanStatus, I.[State]
    ORDER BY I.[Month], G.DegreeName;
END
GO

-- 08. Dashboard_MyUni_Installments: installments per month, degree, plan status and state (Installments tab).
-- In the ERP an installment is a challan of its own: a child of the full-fee challan (ParentIdGuid filled), created when
-- the installment plan is approved, and marked paid like any challan. This is what the ERP's own installment list
-- (UNIStudentsInstallments_GetList) reads, so the tab reads the same:
--   Approved plans = installment challans that are not cancelled or expired (ChallanStatus not 3, 40, 63, 64).
--                    Month = the challan's due date, Amount = NetChallanAmt.
--                    Paid when ChallanStatus is 1 or 62; Overdue when its validity date (else due date) has passed;
--                    otherwise Upcoming.
--   Pending plans  = plans not approved yet (UNIFeeInstallments.InstallmentStatus not 2 or 40) have no challans, so
--                    their rows come from the plan lines (UNIFeeInstallmentsDetail): never Paid.
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
        -- installments of approved plans: the installment challans
        SELECT DATEFROMPARTS(YEAR(ISNULL(C.DueDate, C.TransDate)), MONTH(ISNULL(C.DueDate, C.TransDate)), 1) AS [Month],
               C.DegreeId, C.ParentIdGuid AS PlanId,
               ISNULL(C.NetChallanAmt, ISNULL(C.TotalAmount, 0) - ISNULL(C.TotalDiscountAmt, 0)) AS Amount,
               CAST('Approved' AS VARCHAR(10)) AS PlanStatus,
               CAST(CASE WHEN C.ChallanStatus IN (1, 62) THEN 'Paid'
                         WHEN ISNULL(C.ValidityDate, C.DueDate) < @Today THEN 'Overdue'
                         ELSE 'Upcoming' END AS VARCHAR(10)) AS [State]
        FROM UNIStudentsChallan C WITH (NOLOCK)
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = C.StudentId AND S.Status = 1
        WHERE C.CompanyId = @CompanyId
          AND C.Status = 1
          AND C.ParentIdGuid IS NOT NULL
          AND C.ChallanStatus NOT IN (3, 40, 63, 64)
          AND (ISNULL(@BranchId, 0) = 0 OR C.BranchId = @BranchId)
          AND (@SemesterId IS NULL OR C.RegisterInId = @SemesterId)
          AND ISNULL(C.DueDate, C.TransDate) >= @From AND ISNULL(C.DueDate, C.TransDate) < @To

        UNION ALL

        -- installments of plans still waiting for approval: the plan lines
        SELECT DATEFROMPARTS(YEAR(D.[Month]), MONTH(D.[Month]), 1),
               S.DegreeId, H.Id, ISNULL(D.Amount, 0),
               CAST('Pending' AS VARCHAR(10)),
               CAST(CASE WHEN D.[Month] < @Today THEN 'Overdue' ELSE 'Upcoming' END AS VARCHAR(10))
        FROM UNIFeeInstallmentsDetail D WITH (NOLOCK)
        JOIN UNIFeeInstallments H WITH (NOLOCK) ON H.Id = D.FeeInstallmentId
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = H.StudentId AND S.Status = 1
        WHERE H.CompanyId = @CompanyId
          AND H.Status = 1 AND D.Status = 1
          AND ISNULL(H.InstallmentStatus, 0) NOT IN (2, 40)
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
    ORDER BY I.[Month], G.DegreeName
    OPTION (RECOMPILE);   -- plan for the filters actually chosen
END
GO

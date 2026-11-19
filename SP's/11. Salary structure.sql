-- 11. Dashboard_MyUni_SalaryStructure: the current salary structure of each active employee, one row per employee (Salary structure tab).
-- The current structure is the active row of HRMSalaryStructure (Status = 1); when an employee has more than one,
-- the latest by effective date is used. Expired structures are left out.
-- With @EndDate chosen: the structure that was in force on that date (effective on or before it and not yet expired),
-- for employees who were employed then. @StartDate is not used: a salary structure is a state, not an event.
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_SalaryStructure;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_SalaryStructure
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- not used by the HR tabs
    @DepartmentId INT              = NULL,   -- the employee's department (Employees.DepartmentId); NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- not used by the HR tabs
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- not used by the HR tabs
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL    -- the date the structure must be in force on; NULL = today
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @To DATE = DATEADD(DAY, 1, ISNULL(@EndDate, '99991230'));

    ;WITH Cur AS (
        SELECT S.EmployeeId, S.BasicSalary, S.SpecialAllowance, S.TotalAllowance, S.GrossSalary, S.RatePerDay, S.EffectiveDate,
               ROW_NUMBER() OVER (PARTITION BY S.EmployeeId ORDER BY S.EffectiveDate DESC, S.Id DESC) AS Rn
        FROM HRMSalaryStructure S WITH (NOLOCK)
        WHERE S.CompanyId = @CompanyId
          AND ((@EndDate IS NULL AND S.Status = 1)
               OR (@EndDate IS NOT NULL AND S.EffectiveDate < @To AND (S.ExpiryDate IS NULL OR S.ExpiryDate >= @To)))
    )
    SELECT E.Id AS EmployeeId, E.Code, E.[Name],
           NULLIF(LTRIM(RTRIM(E.Designation)), '') AS Designation,
           D.[Description] AS Department,
           NULLIF(LTRIM(RTRIM(E.EmployeesStatus)), '') AS EmploymentStatus,
           B.[Description] AS Branch,
           ISNULL(C.BasicSalary, 0)      AS BasicSalary,
           ISNULL(C.SpecialAllowance, 0) AS SpecialAllowance,
           ISNULL(C.TotalAllowance, 0)   AS TotalAllowance,
           ISNULL(C.GrossSalary, 0)      AS GrossSalary,
           ISNULL(C.RatePerDay, 0)       AS RatePerDay,
           C.EffectiveDate
    FROM Cur C
    JOIN Employees E WITH (NOLOCK) ON E.Id = C.EmployeeId
         AND ((E.Status = 1 AND E.DiscontinuationDate IS NULL) OR E.DiscontinuationDate >= @To)
         AND (E.HiringDate IS NULL OR E.HiringDate < @To)
    LEFT JOIN Departments D WITH (NOLOCK) ON D.Id = E.DepartmentId
    LEFT JOIN Branches B    WITH (NOLOCK) ON B.Id = E.BranchId
    WHERE C.Rn = 1
      AND (ISNULL(@BranchId, 0) = 0 OR E.BranchId = @BranchId)
      AND (ISNULL(@DepartmentId, 0) = 0 OR E.DepartmentId = @DepartmentId)
    ORDER BY ISNULL(C.GrossSalary, 0) DESC, E.[Name];
END
GO

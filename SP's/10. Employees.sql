-- 10. Dashboard_MyUni_Employees: the staff of the company, one row per employee (Employees tab).
-- Every employee that is active, or that has left (so leavers can be counted). IsActive = active and not discontinued.
-- No personal details (CNIC, phone, address) are returned.
-- With dates chosen: the employees who worked at some point between @StartDate and @EndDate (hired on or before
-- @EndDate, and not gone before @StartDate), and IsActive says whether they were still employed on @EndDate.
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Employees;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Employees
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- not used by the HR tabs
    @DepartmentId INT              = NULL,   -- the employee's department (Employees.DepartmentId); NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- not used by the HR tabs
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- not used by the HR tabs
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL    -- whole day included; NULL = no limit
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @From DATE = ISNULL(@StartDate, '19000101');
    DECLARE @To   DATE = DATEADD(DAY, 1, ISNULL(@EndDate, '99991230'));

    SELECT E.Id AS EmployeeId, E.Code, E.[Name],
           NULLIF(LTRIM(RTRIM(E.Designation)), '') AS Designation,
           D.[Description]  AS Department,
           ET.[Description] AS EmployeeType,
           NULLIF(LTRIM(RTRIM(E.EmployeesStatus)), '') AS EmploymentStatus,   -- Permanent, Contract, Daily Wages ...
           NULLIF(LTRIM(RTRIM(E.Gender)), '') AS Gender,
           B.[Description]  AS Branch,
           E.HiringDate, E.DiscontinuationDate,
           CAST(CASE WHEN (E.Status = 1 AND E.DiscontinuationDate IS NULL) OR E.DiscontinuationDate >= @To THEN 1 ELSE 0 END AS BIT) AS IsActive
    FROM Employees E WITH (NOLOCK)
    LEFT JOIN Departments D    WITH (NOLOCK) ON D.Id  = E.DepartmentId
    LEFT JOIN EmployeeTypes ET WITH (NOLOCK) ON ET.Id = E.TypeId
    LEFT JOIN Branches B       WITH (NOLOCK) ON B.Id  = E.BranchId
    WHERE E.CompanyId = @CompanyId
      AND (E.Status = 1 OR E.DiscontinuationDate IS NOT NULL)
      AND (E.HiringDate IS NULL OR E.HiringDate < @To)
      AND (E.DiscontinuationDate IS NULL OR E.DiscontinuationDate >= @From)
      AND (ISNULL(@BranchId, 0) = 0 OR E.BranchId = @BranchId)
      AND (ISNULL(@DepartmentId, 0) = 0 OR E.DepartmentId = @DepartmentId)
    ORDER BY E.[Name]
    OPTION (RECOMPILE);   -- plan for the filters actually chosen
END
GO

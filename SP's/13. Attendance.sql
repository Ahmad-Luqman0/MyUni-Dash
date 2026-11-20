-- 13. Dashboard_MyUni_Attendance: monthly attendance per month, department and branch (Attendance tab).
-- From the monthly attendance submissions payroll uses (HRMAttendenceApproval, active rows, and their employee lines):
-- days worked, absences, leaves, late arrivals and overtime per employee and month. The date range is on the month.
-- Submissions are counted whatever their approval status (AttendanceStatus).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Attendance;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Attendance
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

    SELECT DATEFROMPARTS(YEAR(A.[Month]), MONTH(A.[Month]), 1) AS [Month],
           DP.[Description] AS Department, B.[Description] AS Branch,
           COUNT(DISTINCT D.EmployeeId)       AS Employees,
           SUM(ISNULL(D.NoOfDays, 0))         AS DaysWorked,
           SUM(ISNULL(D.Absenties, 0))        AS Absences,
           SUM(ISNULL(D.Leaves, 0))           AS Leaves,
           SUM(ISNULL(D.NoOfLateIn, 0))       AS LateArrivals,
           SUM(ISNULL(D.NoOfLateOut, 0))      AS EarlyDepartures,
           SUM(ISNULL(D.InMintLate, 0))       AS LateMinutes,
           SUM(ISNULL(D.OverTimeAmount, 0))   AS OverTimeAmount,
           SUM(ISNULL(D.DeductionAmount, 0))  AS DeductionAmount
    FROM HRMAttendenceApproval A WITH (NOLOCK)
    JOIN HRMAttendenceApprovalDetail D WITH (NOLOCK) ON D.AttendanceApprovalId = A.Id
    JOIN Employees E WITH (NOLOCK) ON E.Id = D.EmployeeId
    LEFT JOIN Departments DP WITH (NOLOCK) ON DP.Id = E.DepartmentId
    LEFT JOIN Branches B     WITH (NOLOCK) ON B.Id  = A.BranchId
    WHERE A.CompanyId = @CompanyId
      AND A.Status = 1
      AND A.[Month] >= @From AND A.[Month] < @To
      AND (ISNULL(@BranchId, 0) = 0 OR A.BranchId = @BranchId)
      AND (ISNULL(@DepartmentId, 0) = 0 OR E.DepartmentId = @DepartmentId)
    GROUP BY DATEFROMPARTS(YEAR(A.[Month]), MONTH(A.[Month]), 1), DP.[Description], B.[Description]
    ORDER BY 1, DP.[Description]
    OPTION (RECOMPILE);   -- plan for the filters actually chosen
END
GO

-- 12. Dashboard_MyUni_SalarySheet: payroll per month, department and branch (Salary sheet tab).
-- From the salary sheets (HRMSalarySheet, active rows) and their lines. The date range is on the sheet month.
-- Gross  = basic + special + total + monthly + recurring allowances.
-- NetPay = the formula of the ERP report HRMSalarySheet_Rp_GetByMonth, which adds up to the sheet's own NetAmount:
--          gross - (monthly and recurring deductions + absent deductions + loans + EOBI + income tax + provident fund).
-- The line columns GrossSalary and NetSalaryPayable are not used: they are empty or do not match the sheet total.
-- Sheets are counted whatever their approval status (SalarySheetStatus).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_SalarySheet;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_SalarySheet
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

    ;WITH L AS (
        SELECT DATEFROMPARTS(YEAR(S.[Month]), MONTH(S.[Month]), 1) AS [Month],
               S.Id AS SheetId, E.DepartmentId, ISNULL(D.BranchId, S.BranchId) AS BranchId, D.EmployeeId,
               ISNULL(D.BasicSalary, 0) AS Basic,
               ISNULL(D.SpecialAllowances, 0) + ISNULL(D.TotalAllowances, 0) + ISNULL(D.MonthlyAllowances, 0) + ISNULL(D.RecurringAllowances, 0) AS Allowances,
               ISNULL(D.OverTimeAmt, 0)   AS OverTime,
               ISNULL(D.ArrearsAmount, 0) AS Arrears,
               ISNULL(D.MonthlyDeductions, 0) + ISNULL(D.RecurringDeductions, 0) + ISNULL(D.AbsentDeductions, 0) AS Deductions,
               ISNULL(D.TotalLoans, 0)    AS Loans,
               ISNULL(D.IncomeTax, 0)     AS IncomeTax,
               ISNULL(D.EOBI, 0)          AS EOBI,
               ISNULL(D.ProvidentFund, 0) AS ProvidentFund
        FROM HRMSalarySheet S WITH (NOLOCK)
        JOIN HRMSalarySheetDetail D WITH (NOLOCK) ON D.HRMSalarySheetId = S.Id
        JOIN Employees E WITH (NOLOCK) ON E.Id = D.EmployeeId
        WHERE S.CompanyId = @CompanyId
          AND S.Status = 1
          AND S.[Month] >= @From AND S.[Month] < @To
          AND (ISNULL(@BranchId, 0) = 0 OR ISNULL(D.BranchId, S.BranchId) = @BranchId)
          AND (ISNULL(@DepartmentId, 0) = 0 OR E.DepartmentId = @DepartmentId)
    )
    SELECT L.[Month], DP.[Description] AS Department, B.[Description] AS Branch,
           COUNT(DISTINCT L.SheetId)    AS Sheets,
           COUNT(DISTINCT L.EmployeeId) AS Employees,
           SUM(L.Basic)         AS BasicSalary,
           SUM(L.Allowances)    AS Allowances,
           SUM(L.OverTime)      AS OverTime,
           SUM(L.Arrears)       AS Arrears,
           SUM(L.Basic + L.Allowances) AS GrossSalary,
           SUM(L.Deductions)    AS Deductions,
           SUM(L.Loans)         AS Loans,
           SUM(L.IncomeTax)     AS IncomeTax,
           SUM(L.EOBI)          AS EOBI,
           SUM(L.ProvidentFund) AS ProvidentFund,
           SUM((L.Basic + L.Allowances) - (L.Deductions + L.Loans + L.EOBI + L.IncomeTax + L.ProvidentFund)) AS NetPay
    FROM L
    LEFT JOIN Departments DP WITH (NOLOCK) ON DP.Id = L.DepartmentId
    LEFT JOIN Branches B     WITH (NOLOCK) ON B.Id  = L.BranchId
    GROUP BY L.[Month], DP.[Description], B.[Description]
    ORDER BY L.[Month], DP.[Description]
    OPTION (RECOMPILE);   -- plan for the filters actually chosen
END
GO

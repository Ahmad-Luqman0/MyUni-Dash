-- 04. Dashboard_MyUni_DepartmentList: departments that belong to a faculty of the company (filter list).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_DepartmentList;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_DepartmentList
    @CompanyId INT              = NULL,
    @FacultyId UNIQUEIDENTIFIER = NULL   -- NULL = every faculty
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT D.Id, D.[Description], F.FacultyGUID AS FacultyId, F.[Description] AS Faculty
    FROM FacultyDetails FD WITH (NOLOCK)
    JOIN Faculty F     WITH (NOLOCK) ON F.FacultyGUID = FD.FacultyGUID
    JOIN Departments D WITH (NOLOCK) ON D.Id = FD.DepartmentId
    WHERE F.Status = 1 AND F.CompanyId = @CompanyId
      AND (@FacultyId IS NULL OR FD.FacultyGUID = @FacultyId)
    ORDER BY D.[Description];
END
GO

-- 03. Dashboard_MyUni_FacultyList: active faculties of the company (filter list).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_FacultyList;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_FacultyList
    @CompanyId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT F.FacultyGUID AS Id, F.[Description], F.Code
    FROM Faculty F WITH (NOLOCK)
    WHERE F.Status = 1 AND F.CompanyId = @CompanyId
    ORDER BY F.[Description];
END
GO

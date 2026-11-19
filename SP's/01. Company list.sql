-- 01. Dashboard_MyUni_CompanyList: companies that have university programs (filter list).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_CompanyList;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_CompanyList
AS
BEGIN
    SET NOCOUNT ON;

    SELECT C.Id, C.CompanyName
    FROM Company C WITH (NOLOCK)
    WHERE C.Status = 1
      AND EXISTS (SELECT 1 FROM UNIDegree UD WITH (NOLOCK) WHERE UD.CompanyId = C.Id AND UD.Status = 1)
    ORDER BY C.Id;
END
GO

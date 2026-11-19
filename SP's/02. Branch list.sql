-- 02. Dashboard_MyUni_BranchList: active branches (campuses) of the company (filter list).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_BranchList;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_BranchList
    @CompanyId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Students: active students of the branch, so the web can put the campuses that are in use first.
    SELECT B.Id, B.[Description], B.Code,
           CT.[Description] AS City,
           (SELECT COUNT(*) FROM UNIStudents S WITH (NOLOCK) WHERE S.BranchId = B.Id AND S.Status = 1) AS Students
    FROM Branches B WITH (NOLOCK)
    LEFT JOIN City CT WITH (NOLOCK) ON CT.Id = B.CityId
    WHERE B.Status = 1 AND B.CompanyId = @CompanyId
    ORDER BY B.Id;
END
GO

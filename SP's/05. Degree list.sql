-- 05. Dashboard_MyUni_DegreeList: active degree programs (filter list).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_DegreeList;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_DegreeList
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @DepartmentId INT              = NULL    -- NULL or 0 = all
AS
BEGIN
    SET NOCOUNT ON;

    SELECT UD.Id, UD.DegreeCode, UD.DegreeName, UD.DepartmentId,
           DL.DegreeLevelName AS DegreeLevel
    FROM UNIDegree UD WITH (NOLOCK)
    LEFT JOIN UNIDegreeLevels DL ON DL.Id = UD.DegreeLevel
    WHERE UD.Status = 1 AND UD.CompanyId = @CompanyId
      AND (ISNULL(@BranchId, 0) = 0 OR UD.BranchId = @BranchId)
      AND (ISNULL(@DepartmentId, 0) = 0 OR UD.DepartmentId = @DepartmentId)
      AND (@FacultyId IS NULL OR EXISTS (SELECT 1 FROM FacultyDetails FD WITH (NOLOCK)
                                         WHERE FD.DepartmentId = UD.DepartmentId AND FD.FacultyGUID = @FacultyId))
    ORDER BY UD.DegreeName;
END
GO

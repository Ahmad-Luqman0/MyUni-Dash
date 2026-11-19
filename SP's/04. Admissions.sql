-- 04. Dashboard_MyUni_Admissions: seats announced and students admitted per semester, degree and shift (Admissions tab).
-- Seats come from the active admission announcements. Admitted = active students admitted to that degree in that
-- semester (UNIStudentAnnounceDetails), on the same shift. @StartDate / @EndDate are not used.
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Admissions;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Admissions
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @DepartmentId INT              = NULL,   -- NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL    -- not used here
AS
BEGIN
    SET NOCOUNT ON;

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
    )
    SELECT SEM.Id AS SemesterId, SEM.Code AS Semester, SEM.StartDate AS SemesterStart,
           G.Id AS DegreeId, G.DegreeCode, G.DegreeName AS Degree, G.Department, G.Faculty,
           PT.[Description] AS ProgramType,
           COUNT(DISTINCT A.Id)            AS Announcements,
           SUM(ISNULL(AD.AvailableSeats, 0)) AS Seats,
           ISNULL(MAX(ADM.Admitted), 0)    AS Admitted,
           MAX(ISNULL(AD.FeeAmount, 0))    AS FeeAmount
    FROM UNIAdmissionAnnouncementDetails AD WITH (NOLOCK)
    JOIN UNIAdmissionAnnouncement A WITH (NOLOCK) ON A.Id = AD.AdmissionAnnouncementId
    JOIN Deg G ON G.Id = AD.DegreeId
    LEFT JOIN UNIAcademicYearSemesterDetails SEM WITH (NOLOCK) ON SEM.Id = AD.SemesterSessionId
    LEFT JOIN ProgramType PT WITH (NOLOCK) ON PT.Id = AD.ProgramTypeId
    OUTER APPLY (SELECT COUNT(DISTINCT SA.StudentsId) AS Admitted
                 FROM UNIStudentAnnounceDetails SA WITH (NOLOCK)
                 JOIN UNIStudents S WITH (NOLOCK) ON S.Id = SA.StudentsId AND S.Status = 1
                 WHERE SA.DegreeId = AD.DegreeId
                   AND SA.SemesterSessionId = AD.SemesterSessionId
                   AND SA.Status = 1
                   AND (AD.ProgramTypeId IS NULL OR S.ShiftId = AD.ProgramTypeId)
                   AND (ISNULL(@BranchId, 0) = 0 OR S.BranchId = @BranchId)) ADM
    WHERE A.CompanyId = @CompanyId
      AND A.Status = 1
      AND (ISNULL(@BranchId, 0) = 0 OR A.BranchId = @BranchId)
      AND (@SemesterId IS NULL OR AD.SemesterSessionId = @SemesterId)
    GROUP BY SEM.Id, SEM.Code, SEM.StartDate, G.Id, G.DegreeCode, G.DegreeName, G.Department, G.Faculty, PT.[Description]
    ORDER BY SEM.StartDate, G.DegreeName;
END
GO

-- 03. Dashboard_MyUni_Registrations: registered students per semester, degree, semester number and shift (Students tab).
-- A registration counts when it is active, its student is active, and it falls in the semester
-- (RegisterInId; the first semester, SemesterSessionId, when RegisterInId is empty).
-- With dates chosen, only the semesters running in @StartDate to @EndDate are counted. A semester runs from its
-- start until the next one starts, so every date belongs to a semester.
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Registrations;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Registrations
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @DepartmentId INT              = NULL,   -- NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL    -- whole day included; NULL = no limit
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @From     DATE = ISNULL(@StartDate, '19000101');
    DECLARE @To       DATE = DATEADD(DAY, 1, ISNULL(@EndDate, '99991230'));
    DECLARE @AllDates BIT  = CASE WHEN @StartDate IS NULL AND @EndDate IS NULL THEN 1 ELSE 0 END;

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
    ),
    -- Sem: the semesters the dates select. A semester is taken to run from its start until the next semester of the
    -- company starts (or to its own end date when that is later), and the latest one has no end. So the gaps between
    -- semesters, and a semester stored with a one-day span, still belong to a semester.
    Sem AS (
        SELECT SD.Id
        FROM UNIAcademicYearSemesterDetails SD WITH (NOLOCK)
        JOIN UNIAcademicCalender AC WITH (NOLOCK) ON AC.Id = SD.AcademicCalenderId AND AC.CompanyId = @CompanyId
        OUTER APPLY (SELECT MIN(N.StartDate) AS NextStart
                     FROM UNIAcademicYearSemesterDetails N WITH (NOLOCK)
                     JOIN UNIAcademicCalender NC WITH (NOLOCK) ON NC.Id = N.AcademicCalenderId AND NC.CompanyId = @CompanyId
                     WHERE N.StartDate > SD.StartDate) NX
        WHERE SD.StartDate < @To
          AND CASE WHEN NX.NextStart IS NULL THEN CAST('99991231' AS DATE)
                   WHEN SD.EndDate > DATEADD(DAY, -1, NX.NextStart) THEN SD.EndDate
                   ELSE DATEADD(DAY, -1, NX.NextStart) END >= @From
    )
    SELECT SEM.Id AS SemesterId, SEM.Code AS Semester, SEM.StartDate AS SemesterStart,
           G.Id AS DegreeId, G.DegreeCode, G.DegreeName AS Degree, G.Department, G.Faculty,
           R.SemesterNo, PT.[Description] AS ProgramType,
           COUNT(DISTINCT R.StudentsId) AS Students
    FROM UNIStudentsRegistrations R WITH (NOLOCK)
    JOIN UNIStudents S WITH (NOLOCK) ON S.Id = R.StudentsId AND S.Status = 1
    JOIN Deg G ON G.Id = R.DegreeId
    LEFT JOIN UNIAcademicYearSemesterDetails SEM WITH (NOLOCK) ON SEM.Id = ISNULL(R.RegisterInId, R.SemesterSessionId)
    LEFT JOIN ProgramType PT WITH (NOLOCK) ON PT.Id = S.ShiftId
    WHERE R.CompanyId = @CompanyId
      AND R.Status = 1
      AND (ISNULL(@BranchId, 0) = 0 OR R.BranchId = @BranchId)
      AND (@SemesterId IS NULL OR ISNULL(R.RegisterInId, R.SemesterSessionId) = @SemesterId)
      AND (@AllDates = 1 OR ISNULL(R.RegisterInId, R.SemesterSessionId) IN (SELECT Id FROM Sem))
    GROUP BY SEM.Id, SEM.Code, SEM.StartDate, G.Id, G.DegreeCode, G.DegreeName, G.Department, G.Faculty,
             R.SemesterNo, PT.[Description]
    ORDER BY SEM.StartDate, G.DegreeName, R.SemesterNo
    OPTION (RECOMPILE);   -- plan for the filters actually chosen
END
GO

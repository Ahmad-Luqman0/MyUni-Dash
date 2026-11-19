-- 01. Dashboard_MyUni_Filters: the filter lists shown above every tab, and the semester strip. One call per list.
-- @Section = Companies | Branches | Faculties | Departments | Degrees | Semesters | EmployeeDepartments
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Filters;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Filters
    @Section      VARCHAR(30),               -- which list: Companies, Branches, Faculties, Departments, Degrees, Semesters, EmployeeDepartments
    @CompanyId    INT              = NULL,   -- every list except Companies: the chosen company
    @BranchId     INT              = NULL,   -- Degrees, Semesters, EmployeeDepartments: NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- Departments, Degrees: NULL = all
    @DepartmentId INT              = NULL    -- Degrees: NULL or 0 = all
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Companies: every active company
    IF @Section = 'Companies'
    BEGIN
        SELECT C.Id, C.CompanyName
        FROM Company C WITH (NOLOCK)
        WHERE C.Status = 1
        ORDER BY C.Id;

        RETURN;
    END

    -- 2. Branches: active branches (campuses) of the company.
    --    Students = active students of the branch, so the web can tell which campuses are in use.
    IF @Section = 'Branches'
    BEGIN
        SELECT B.Id, B.[Description], B.Code,
               CT.[Description] AS City,
               (SELECT COUNT(*) FROM UNIStudents S WITH (NOLOCK) WHERE S.BranchId = B.Id AND S.Status = 1) AS Students
        FROM Branches B WITH (NOLOCK)
        LEFT JOIN City CT WITH (NOLOCK) ON CT.Id = B.CityId
        WHERE B.Status = 1 AND B.CompanyId = @CompanyId
        ORDER BY B.Id;

        RETURN;
    END

    -- 3. Faculties: active faculties of the company
    IF @Section = 'Faculties'
    BEGIN
        SELECT F.FacultyGUID AS Id, F.[Description], F.Code
        FROM Faculty F WITH (NOLOCK)
        WHERE F.Status = 1 AND F.CompanyId = @CompanyId
        ORDER BY F.[Description];

        RETURN;
    END

    -- 4. Departments: departments that belong to a faculty of the company
    IF @Section = 'Departments'
    BEGIN
        SELECT DISTINCT D.Id, D.[Description], F.FacultyGUID AS FacultyId, F.[Description] AS Faculty
        FROM FacultyDetails FD WITH (NOLOCK)
        JOIN Faculty F     WITH (NOLOCK) ON F.FacultyGUID = FD.FacultyGUID
        JOIN Departments D WITH (NOLOCK) ON D.Id = FD.DepartmentId
        WHERE F.Status = 1 AND F.CompanyId = @CompanyId
          AND (@FacultyId IS NULL OR FD.FacultyGUID = @FacultyId)
        ORDER BY D.[Description];

        RETURN;
    END

    -- 5. Degrees: active degree programs
    IF @Section = 'Degrees'
    BEGIN
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

        RETURN;
    END

    -- 6. Semesters: semesters of the company's academic calendars.
    --    Students = active students registered in the semester (RegisterInId, or the first semester when RegisterInId is empty).
    IF @Section = 'Semesters'
    BEGIN
        SELECT SEM.Id, SEM.Code, AC.CalenderName AS Calendar, SEM.StartDate, SEM.EndDate,
               ISNULL(SEM.IsAdmissionOpen, 0) AS IsAdmissionOpen,
               (SELECT COUNT(DISTINCT R.StudentsId)
                FROM UNIStudentsRegistrations R WITH (NOLOCK)
                JOIN UNIStudents S WITH (NOLOCK) ON S.Id = R.StudentsId AND S.Status = 1
                WHERE ISNULL(R.RegisterInId, R.SemesterSessionId) = SEM.Id
                  AND R.Status = 1 AND R.CompanyId = @CompanyId
                  AND (ISNULL(@BranchId, 0) = 0 OR R.BranchId = @BranchId)) AS Students
        FROM UNIAcademicYearSemesterDetails SEM WITH (NOLOCK)
        JOIN UNIAcademicCalender AC WITH (NOLOCK) ON AC.Id = SEM.AcademicCalenderId
        WHERE AC.CompanyId = @CompanyId
          AND (ISNULL(@BranchId, 0) = 0 OR AC.BranchId = @BranchId)
        ORDER BY SEM.StartDate, SEM.OrderId;

        RETURN;
    END

    -- 7. EmployeeDepartments: departments that have active employees (the Department filter of the HR tabs).
    IF @Section = 'EmployeeDepartments'
    BEGIN
        SELECT D.Id, D.[Description], COUNT(*) AS Employees
        FROM Employees E WITH (NOLOCK)
        JOIN Departments D WITH (NOLOCK) ON D.Id = E.DepartmentId
        WHERE E.CompanyId = @CompanyId AND E.Status = 1
          AND (ISNULL(@BranchId, 0) = 0 OR E.BranchId = @BranchId)
        GROUP BY D.Id, D.[Description]
        ORDER BY D.[Description];

        RETURN;
    END
END
GO

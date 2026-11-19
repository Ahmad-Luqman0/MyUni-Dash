-- 06. Dashboard_MyUni_SemesterList: semesters of the company's academic calendars (filter list and the semester strip).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_SemesterList;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_SemesterList
    @CompanyId INT = NULL,
    @BranchId  INT = NULL   -- NULL or 0 = all
AS
BEGIN
    SET NOCOUNT ON;

    -- Students: active students registered in the semester (RegisterInId, or the first semester when RegisterInId is empty).
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
END
GO

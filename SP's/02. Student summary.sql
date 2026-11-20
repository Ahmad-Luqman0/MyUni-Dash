-- 02. Dashboard_MyUni_StudentSummary: the headline numbers of the Overview tab, one row.
-- Every figure follows @StartDate / @EndDate:
-- Students: students on record in the allowed degrees; with dates, those registered in a semester running in the dates
--           (a semester runs from its start until the next one starts, so every date belongs to a semester).
-- RegisteredStudents, NewAdmissions: for the chosen semester, or the semesters running in the dates.
-- DegreeCompleted: students flagged as completed; with dates, those whose completion date falls in them.
-- Billed (shown as Total challan), Received (Paid), Outstanding (Unpaid), Discounts: challans dated in the range
--           (rules of Dashboard_MyUni_Receivables: total = ChallanStatus 4 or 62, paid = 62, unpaid = 4, open).
-- Overdue: open challans (ChallanStatus 4) that fell due in the dates, judged on @EndDate.
-- Defaulters: students of Dashboard_MyUni_Defaulters (rules of the ERP report UNIStudents_Rp_GetDefaulterData).
-- Collected: receipts dated in the range (rules of Dashboard_MyUni_Collections).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_StudentSummary;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_StudentSummary
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @DepartmentId INT              = NULL,   -- NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL,   -- whole day included; NULL = no limit
    @RequireApproved BIT           = 1       -- not used any more (kept so the API's call still works)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @From     DATE = ISNULL(@StartDate, '19000101');
    DECLARE @To       DATE = DATEADD(DAY, 1, ISNULL(@EndDate, '99991230'));
    DECLARE @AllDates BIT  = CASE WHEN @StartDate IS NULL AND @EndDate IS NULL THEN 1 ELSE 0 END;
    DECLARE @Today    DATE = CAST(GETDATE() AS DATE);
    DECLARE @AsOf     DATE = CASE WHEN @EndDate IS NULL OR @EndDate > @Today THEN @Today ELSE DATEADD(DAY, 1, @EndDate) END;

    -- #BankPaid: the challans that already have a verified bank receipt, keyed so each cash fee receipt is checked with
    -- one index seek. (Checking against the bank receipt tables directly took minutes on a full database.)
    CREATE TABLE #BankPaid (StudentId UNIQUEIDENTIFIER NOT NULL, ChallanNo NVARCHAR(200) NOT NULL, PRIMARY KEY (StudentId, ChallanNo));
    INSERT INTO #BankPaid (StudentId, ChallanNo)
    SELECT DISTINCT BD.StudentId, CAST(BD.ChallanNo AS NVARCHAR(200))
    FROM UNIBankReceiptsDetail BD WITH (NOLOCK)
    JOIN UNIBankReceipts BH WITH (NOLOCK) ON BH.Id = BD.BankReceiptId
    WHERE BH.Status = 1 AND BD.DocStatus = 35 AND BH.BankReceiptStatus IN (2, 34)
      AND BD.StudentId IS NOT NULL AND BD.ChallanNo IS NOT NULL;

    -- #Bank: the verified bank receipt lines in the dates, read once.
    SELECT BR.UploadedDate, BRD.StudentId, CAST(BRD.ChallanNo AS NVARCHAR(200)) AS ChallanNo,
           ISNULL(BRD.DegreeId, S.DegreeId) AS DegreeId, ISNULL(BRD.Amount, 0) AS Amount
    INTO #Bank
    FROM UNIBankReceiptsDetail BRD WITH (NOLOCK)
    JOIN UNIBankReceipts BR WITH (NOLOCK) ON BR.Id = BRD.BankReceiptId
    JOIN UNIStudents S WITH (NOLOCK) ON S.Id = BRD.StudentId AND S.Status = 1
    WHERE BR.Status = 1
      AND BRD.DocStatus = 35
      AND BR.BankReceiptStatus IN (2, 34)
      AND (ISNULL(@BranchId, 0) = 0 OR BR.BranchId = @BranchId)
      AND BR.UploadedDate >= @From AND BR.UploadedDate < @To
    OPTION (RECOMPILE);

    -- #ChalSem: with a semester chosen, a bank line counts when the latest challan of its student and challan number
    -- belongs to that semester. Only the students who have a challan in the semester are looked at. (Listing every
    -- challan of the database, or looking the challan up once per bank line, took minutes.)
    CREATE TABLE #ChalSem (StudentId UNIQUEIDENTIFIER NOT NULL, ChallanNo NVARCHAR(200) NOT NULL);
    IF @SemesterId IS NOT NULL
        INSERT INTO #ChalSem (StudentId, ChallanNo)
        SELECT X.StudentId, X.ChallanNo
        FROM (SELECT C.StudentId, CAST(C.ChallanNo AS NVARCHAR(200)) AS ChallanNo, C.RegisterInId,
                     ROW_NUMBER() OVER (PARTITION BY C.StudentId, C.ChallanNo ORDER BY C.TransDate DESC, C.Id) AS Seq
              FROM UNIStudentsChallan C WITH (NOLOCK)
              WHERE C.ChallanNo IS NOT NULL
                AND C.StudentId IN (SELECT C2.StudentId FROM UNIStudentsChallan C2 WITH (NOLOCK) WHERE C2.RegisterInId = @SemesterId)
                AND C.StudentId IN (SELECT B.StudentId FROM #Bank B)) X
        WHERE X.Seq = 1 AND X.RegisterInId = @SemesterId
        OPTION (RECOMPILE);
    CREATE CLUSTERED INDEX IX_ChalSem ON #ChalSem (StudentId, ChallanNo);

    -- #Deg: the degree programs the filters allow, with their department and faculty names. Worked out once and kept
    -- in a temporary table, because more than one query below needs it.
    SELECT UD.Id, UD.DegreeCode, UD.DegreeName, UD.Status, D.[Description] AS Department, FA.Faculty
    INTO #Deg
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
    OPTION (RECOMPILE);


    -- #Ch: the challans of the filters, read once; every money figure and the defaulters count come from it.
    SELECT C.StudentId, C.DegreeId,
           ISNULL(C.NetChallanAmt, ISNULL(C.TotalAmount, 0) - ISNULL(C.TotalDiscountAmt, 0)) AS Net,
           ISNULL(C.TotalDiscountAmt, 0) + ISNULL(C.GovtFeeDiscountAmt, 0) AS Discount,
           CASE WHEN C.TransDate >= @From AND C.TransDate < @To THEN 1 ELSE 0 END AS InRange,
           CASE WHEN C.ChallanStatus IN (4, 62) THEN 1 ELSE 0 END AS IsBilled,
           CASE WHEN C.ChallanStatus = 62 THEN 1 ELSE 0 END AS IsPaid,
           CASE WHEN C.ChallanStatus = 4
                     AND ISNULL(C.ValidityDate, C.DueDate) < @AsOf THEN 1 ELSE 0 END AS IsOverdue,
           -- for the defaulters count (rules of Dashboard_MyUni_Defaulters)
           CASE WHEN C.ParentIdGuid IS NULL AND C.ChallanStatus NOT IN (3, 40) THEN 1 ELSE 0 END AS DefFee,
           CASE WHEN C.ChallanStatus IN (1, 62) THEN 1 ELSE 0 END AS DefPaid,
           CASE WHEN ISNULL(C.ValidityDate, C.DueDate) < @AsOf THEN 1 ELSE 0 END AS DefPastDue,
           CASE WHEN C.ChallanStatus NOT IN (40, 63)
                     AND (S.AdmissionNumber <> 'Admission Offer'
                          OR (S.AdmissionNumber = 'Admission Offer' AND C.ChallanStatus IN (1, 62))) THEN 1 ELSE 0 END AS DefListed,
           CASE WHEN @AllDates = 1 OR (ISNULL(C.ValidityDate, C.DueDate) >= @From AND ISNULL(C.ValidityDate, C.DueDate) < @To) THEN 1 ELSE 0 END AS InDue
    INTO #Ch
    FROM UNIStudentsChallan C WITH (NOLOCK)
    JOIN UNIStudents S WITH (NOLOCK) ON S.Id = C.StudentId AND S.Status = 1
    JOIN #Deg G ON G.Id = C.DegreeId
    WHERE C.CompanyId = @CompanyId
      AND C.Status = 1
      AND (ISNULL(@BranchId, 0) = 0 OR C.BranchId = @BranchId)
      AND (@SemesterId IS NULL OR C.RegisterInId = @SemesterId)
    OPTION (RECOMPILE);

    -- Sem: the semesters the dates select. A semester is taken to run from its start until the next semester of the
    -- company starts (or to its own end date when that is later), and the latest one has no end. So the gaps between
    -- semesters, and a semester stored with a one-day span, still belong to a semester.
    ;WITH Sem AS (
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
    ),
    -- Due: one row per student and degree; a defaulter has a balance and a challan whose validity date has passed.
    Due AS (
        SELECT C.StudentId, C.DegreeId
        FROM #Ch C
        WHERE C.InDue = 1
        GROUP BY C.StudentId, C.DegreeId
        HAVING SUM(C.DefFee * C.Net) - SUM(C.DefPaid * C.Net) > 0 AND SUM(C.DefPastDue) > 0 AND SUM(C.DefListed) > 0
    ),
    -- Fin: the money figures, added up in one pass over the challans.
    Fin AS (
        SELECT SUM(CASE WHEN C.InRange = 1 THEN C.IsBilled * C.Net END)      AS Billed,
               SUM(CASE WHEN C.InRange = 1 THEN C.IsPaid * C.Net END)        AS Received,
               SUM(CASE WHEN C.InRange = 1 THEN C.IsBilled * C.Discount END) AS Discounts,
               SUM(CASE WHEN C.IsOverdue = 1 AND C.InDue = 1 THEN C.Net END) AS Overdue
        FROM #Ch C
    ),
    Rec AS (
        SELECT ISNULL(SC.DegreeId, S.DegreeId) AS DegreeId, ISNULL(FR.FeeAmount, ISNULL(FR.TotalAmount, 0)) AS Amount
        FROM AEOFeeReceipts FR WITH (NOLOCK)
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = FR.UNIStudentId AND S.Status = 1
        LEFT JOIN UNIStudentsChallan SC WITH (NOLOCK) ON SC.Id = FR.UNIChallanId
        WHERE FR.CompanyId = @CompanyId
          AND FR.Status = 1
          AND FR.FeeStatus IN (4, 19)                       -- 4 = received (set when the receipt is saved), 19 = approved
          AND (SC.Id IS NULL OR SC.ChallanStatus <> 40)     -- not against a cancelled challan
          -- not already counted as a bank receipt for the same challan
          AND NOT EXISTS (SELECT 1 FROM #BankPaid BP WHERE BP.StudentId = FR.UNIStudentId AND BP.ChallanNo = SC.ChallanNo)
          AND (ISNULL(@BranchId, 0) = 0 OR FR.BranchId = @BranchId)
          AND FR.TransDate >= @From AND FR.TransDate < @To
          AND (@SemesterId IS NULL OR SC.RegisterInId = @SemesterId)

        UNION ALL

        SELECT B.DegreeId, B.Amount
        FROM #Bank B
        WHERE @SemesterId IS NULL
           OR EXISTS (SELECT 1 FROM #ChalSem SC WHERE SC.StudentId = B.StudentId AND SC.ChallanNo = B.ChallanNo)
    )
    SELECT
        (SELECT COUNT(*) FROM UNIStudents S WITH (NOLOCK) JOIN #Deg G ON G.Id = S.DegreeId
         WHERE S.Status = 1 AND (ISNULL(@BranchId, 0) = 0 OR S.BranchId = @BranchId)
           AND (@AllDates = 1 OR EXISTS (SELECT 1 FROM UNIStudentsRegistrations R WITH (NOLOCK)
                                         WHERE R.StudentsId = S.Id AND R.Status = 1
                                           AND ISNULL(R.RegisterInId, R.SemesterSessionId) IN (SELECT Id FROM Sem)))) AS Students,

        (SELECT COUNT(DISTINCT R.StudentsId)
         FROM UNIStudentsRegistrations R WITH (NOLOCK)
         JOIN UNIStudents S WITH (NOLOCK) ON S.Id = R.StudentsId AND S.Status = 1
         JOIN #Deg G ON G.Id = R.DegreeId
         WHERE R.CompanyId = @CompanyId AND R.Status = 1
           AND (ISNULL(@BranchId, 0) = 0 OR R.BranchId = @BranchId)
           AND (@SemesterId IS NULL OR ISNULL(R.RegisterInId, R.SemesterSessionId) = @SemesterId)
           AND (@AllDates = 1 OR ISNULL(R.RegisterInId, R.SemesterSessionId) IN (SELECT Id FROM Sem))) AS RegisteredStudents,

        (SELECT COUNT(*) FROM UNIStudents S WITH (NOLOCK) JOIN #Deg G ON G.Id = S.DegreeId
         WHERE S.Status = 1 AND S.IsDegreeCompleted = 1
           AND (ISNULL(@BranchId, 0) = 0 OR S.BranchId = @BranchId)
           AND (@AllDates = 1 OR (S.CompletionDate >= @From AND S.CompletionDate < @To))) AS DegreeCompleted,

        (SELECT COUNT(*) FROM #Deg G WHERE G.Status = 1) AS Programs,

        (SELECT COUNT(DISTINCT SA.StudentsId)
         FROM UNIStudentAnnounceDetails SA WITH (NOLOCK)
         JOIN UNIStudents S WITH (NOLOCK) ON S.Id = SA.StudentsId AND S.Status = 1
         JOIN #Deg G ON G.Id = SA.DegreeId
         WHERE SA.Status = 1
           AND (ISNULL(@BranchId, 0) = 0 OR S.BranchId = @BranchId)
           AND (@SemesterId IS NULL OR SA.SemesterSessionId = @SemesterId)
           AND (@AllDates = 1 OR SA.SemesterSessionId IN (SELECT Id FROM Sem))) AS NewAdmissions,

        ISNULL(F.Billed, 0) AS Billed,
        ISNULL(F.Received, 0) AS Received,
        ISNULL(F.Billed - F.Received, 0) AS Outstanding,
        ISNULL(F.Overdue, 0) AS Overdue,
        (SELECT COUNT(DISTINCT D.StudentId) FROM Due D) AS Defaulters,
        ISNULL(F.Discounts, 0) AS Discounts,
        ISNULL((SELECT SUM(R.Amount) FROM Rec R JOIN #Deg G ON G.Id = R.DegreeId), 0) AS Collected
    FROM Fin F
    OPTION (RECOMPILE);   -- plan for the dates actually asked for, and for the real size of the lists above
END
GO

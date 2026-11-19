-- 05. Dashboard_MyUni_Collections: money received per day, source, degree and challan type (Collections tab).
-- Two sources:
--   Cash Fee Receipt = AEOFeeReceipts of a university student, not deleted (Status 1), received or approved
--                      (FeeStatus 4 or 19), dated by TransDate. The ERP saves a university fee receipt with FeeStatus 4
--                      and marks its challan paid at once (UNIFeeRecipts_Insertion), so 4 is money received.
--                      Left out: receipts against a cancelled challan, as in the ERP's list AEOFeeReceipts_GetListForUNI,
--                      and receipts whose challan already has a verified bank receipt (so nothing is counted twice).
--   Bank receipt     = UNIBankReceiptsDetail verified (DocStatus 35) on an approved / posted upload (BankReceiptStatus 2, 34), dated by UploadedDate
-- @RequireApproved is no longer used (kept so the API's call still works).
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Collections;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Collections
    @CompanyId    INT              = NULL,
    @BranchId     INT              = NULL,   -- NULL or 0 = all
    @FacultyId    UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @DepartmentId INT              = NULL,   -- NULL or 0 = all
    @DegreeId     UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @SemesterId   UNIQUEIDENTIFIER = NULL,   -- NULL = all
    @StartDate    DATE             = NULL,   -- NULL = no limit
    @EndDate      DATE             = NULL,   -- whole day included; NULL = no limit
    @RequireApproved BIT           = 1       -- not used any more
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @From DATE = ISNULL(@StartDate, '19000101');
    DECLARE @To   DATE = DATEADD(DAY, 1, ISNULL(@EndDate, '99991230'));

    -- The challans that already have a verified bank receipt, keyed so each cash fee receipt is checked with one
    -- index seek. (Checking against the bank receipt tables directly took minutes on a full database.)
    DECLARE @BankPaid TABLE (StudentId UNIQUEIDENTIFIER NOT NULL, ChallanNo NVARCHAR(200) NOT NULL, PRIMARY KEY (StudentId, ChallanNo));
    INSERT INTO @BankPaid (StudentId, ChallanNo)
    SELECT DISTINCT BD.StudentId, CAST(BD.ChallanNo AS NVARCHAR(200))
    FROM UNIBankReceiptsDetail BD WITH (NOLOCK)
    JOIN UNIBankReceipts BH WITH (NOLOCK) ON BH.Id = BD.BankReceiptId
    WHERE BH.Status = 1 AND BD.DocStatus = 35 AND BH.BankReceiptStatus IN (2, 34)
      AND BD.StudentId IS NOT NULL AND BD.ChallanNo IS NOT NULL;

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
    Rec AS (
        SELECT CAST(FR.TransDate AS DATE) AS ReceiptDate, CAST('Cash Fee Receipt' AS VARCHAR(20)) AS Source,
               ISNULL(SC.DegreeId, S.DegreeId) AS DegreeId, SC.ChallanTypeId,
               ISNULL(DT.Amount, ISNULL(FR.TotalAmount, 0)) AS Amount
        FROM AEOFeeReceipts FR WITH (NOLOCK)
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = FR.UNIStudentId AND S.Status = 1
        LEFT JOIN UNIStudentsChallan SC WITH (NOLOCK) ON SC.Id = FR.UNIChallanId
        OUTER APPLY (SELECT SUM(ISNULL(FRD.Amount, 0)) AS Amount
                     FROM AEOFeeReceiptsDetail FRD WITH (NOLOCK) WHERE FRD.FeeReceiptId = FR.Id) DT
        WHERE FR.CompanyId = @CompanyId
          AND FR.Status = 1
          AND FR.FeeStatus IN (4, 19)                       -- 4 = received (set when the receipt is saved), 19 = approved
          AND (SC.Id IS NULL OR SC.ChallanStatus <> 40)     -- not against a cancelled challan
          -- not already counted as a bank receipt for the same challan
          AND NOT EXISTS (SELECT 1 FROM @BankPaid BP WHERE BP.StudentId = FR.UNIStudentId AND BP.ChallanNo = SC.ChallanNo)
          AND (ISNULL(@BranchId, 0) = 0 OR FR.BranchId = @BranchId)
          AND FR.TransDate >= @From AND FR.TransDate < @To
          AND (@SemesterId IS NULL OR SC.RegisterInId = @SemesterId)

        UNION ALL

        SELECT BR.UploadedDate, CAST('Bank receipt' AS VARCHAR(20)),
               ISNULL(BRD.DegreeId, S.DegreeId), SC.ChallanTypeId,
               ISNULL(BRD.Amount, 0)
        FROM UNIBankReceiptsDetail BRD WITH (NOLOCK)
        JOIN UNIBankReceipts BR WITH (NOLOCK) ON BR.Id = BRD.BankReceiptId
        JOIN UNIStudents S WITH (NOLOCK) ON S.Id = BRD.StudentId AND S.Status = 1
        OUTER APPLY (SELECT TOP 1 C.ChallanTypeId, C.RegisterInId
                     FROM UNIStudentsChallan C WITH (NOLOCK)
                     WHERE C.StudentId = BRD.StudentId AND C.ChallanNo = BRD.ChallanNo
                     ORDER BY C.TransDate DESC) SC
        WHERE BR.Status = 1
          AND BRD.DocStatus = 35
          AND BR.BankReceiptStatus IN (2, 34)
          AND (ISNULL(@BranchId, 0) = 0 OR BR.BranchId = @BranchId)
          AND BR.UploadedDate >= @From AND BR.UploadedDate < @To
          AND (@SemesterId IS NULL OR SC.RegisterInId = @SemesterId)
    )
    SELECT R.ReceiptDate, R.Source,
           G.Id AS DegreeId, G.DegreeCode, G.DegreeName AS Degree, G.Department, G.Faculty,
           CT.ChallanType,
           COUNT(*)      AS Receipts,
           SUM(R.Amount) AS Amount
    FROM Rec R
    JOIN Deg G ON G.Id = R.DegreeId
    LEFT JOIN UNIChallanTypes CT ON CT.Id = R.ChallanTypeId
    GROUP BY R.ReceiptDate, R.Source, G.Id, G.DegreeCode, G.DegreeName, G.Department, G.Faculty, CT.ChallanType
    ORDER BY R.ReceiptDate, R.Source, G.DegreeName;
END
GO

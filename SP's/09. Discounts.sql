-- 09. Dashboard_MyUni_Discounts: fee discounts and scholarships per type, category, fee type, degree and status (Discounts tab).
-- One row of UNIFeeDiscountDetails is one discount given to a student on a fee type.
-- StatusText: Approved when the discount's DiscountStatus = 2, else Pending. The date range is on the discount start date.
-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver: Execute script, Alt+X).

USE SAC400;
GO

DROP PROCEDURE IF EXISTS dbo.Dashboard_MyUni_Discounts;
GO
CREATE PROCEDURE dbo.Dashboard_MyUni_Discounts
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

    DECLARE @From DATE = ISNULL(@StartDate, '19000101');
    DECLARE @To   DATE = DATEADD(DAY, 1, ISNULL(@EndDate, '99991230'));

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
    SELECT ISNULL(DT.[Description], 'Other discount') AS DiscountType,
           ISNULL(DC.[Description], 'No category')    AS Category,
           FT.[Description] AS FeeType,
           G.Id AS DegreeId, G.DegreeCode, G.DegreeName AS Degree, G.Department, G.Faculty,
           CASE WHEN H.DiscountStatus = 2 THEN 'Approved' ELSE 'Pending' END AS StatusText,
           COUNT(DISTINCT D.StudentId)         AS Students,
           SUM(ISNULL(D.DiscountedAmount, 0))  AS Amount
    FROM UNIFeeDiscountDetails D WITH (NOLOCK)
    JOIN UNIFeeDiscount H WITH (NOLOCK) ON H.Id = D.FeedDiscountId
    JOIN UNIStudents S WITH (NOLOCK) ON S.Id = D.StudentId AND S.Status = 1
    JOIN Deg G ON G.Id = ISNULL(D.DegreeId, S.DegreeId)
    LEFT JOIN UNIDiscountsTypes DT ON DT.Id = D.DiscountsTypeId
    LEFT JOIN UNIDiscountCatagory DC ON DC.Id = H.DiscountCatagoryId
    LEFT JOIN UNIFeeTypes FT WITH (NOLOCK) ON FT.Id = D.FeeTypeId
    WHERE H.CompanyId = @CompanyId
      AND H.Status = 1 AND D.Status = 1
      AND (ISNULL(@BranchId, 0) = 0 OR H.BranchId = @BranchId)
      AND (@SemesterId IS NULL OR H.AppliedSemesterId = @SemesterId)
      AND (H.StartDate IS NULL OR (H.StartDate >= @From AND H.StartDate < @To))
    GROUP BY DT.[Description], DC.[Description], FT.[Description],
             G.Id, G.DegreeCode, G.DegreeName, G.Department, G.Faculty,
             CASE WHEN H.DiscountStatus = 2 THEN 'Approved' ELSE 'Pending' END
    ORDER BY SUM(ISNULL(D.DiscountedAmount, 0)) DESC
    OPTION (RECOMPILE);   -- plan for the filters actually chosen
END
GO

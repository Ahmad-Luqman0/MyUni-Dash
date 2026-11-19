using MyUni.API.Data;
using Microsoft.AspNetCore.Mvc;

namespace MyUni.API.Controllers;

/// <summary>Dashboard data, read from the per-portion procedures of the SP's folder (dbo.Dashboard_MyUni_*).</summary>
[ApiController]
[Route("api/dashboard")]
public sealed class DashboardController(DashboardDb db) : ControllerBase
{
    /// <summary>Portions served as plain rows. Only these names can be run from the web.</summary>
    private static readonly HashSet<string> Portions = new(StringComparer.OrdinalIgnoreCase)
    {
        "Summary", "Registrations", "Admissions", "Collections", "Receivables", "Defaulters", "Installments", "Discounts",
        "Employees", "SalaryStructure", "SalarySheet", "Attendance",
    };

    /// <summary>Runs one portion through its procedure with the shared filters. Ints: 0 or missing = all; guids and dates: missing = all.</summary>
    [HttpGet("{portion}")]
    public async Task<IActionResult> Portion(
        string portion,
        [FromQuery] int companyId,
        [FromQuery] int branchId,
        [FromQuery] string? facultyId,
        [FromQuery] int departmentId,
        [FromQuery] string? degreeId,
        [FromQuery] string? semesterId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken ct)
    {
        if (!Portions.TryGetValue(portion, out var section)) return NotFound(new { error = $"Unknown portion '{portion}'." });
        var rows = await db.SectionRowsAsync(section, new
        {
            CompanyId = companyId,
            BranchId = branchId,
            FacultyId = DashboardDb.ParseGuid(facultyId),
            DepartmentId = departmentId,
            DegreeId = DashboardDb.ParseGuid(degreeId),
            SemesterId = DashboardDb.ParseGuid(semesterId),
            StartDate = startDate?.Date,
            EndDate = endDate?.Date,
        }, ct);
        return Ok(rows);
    }
}

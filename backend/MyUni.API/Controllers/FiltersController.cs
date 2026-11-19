using MyUni.API.Data;
using Microsoft.AspNetCore.Mvc;

namespace MyUni.API.Controllers;

/// <summary>Filter lists: Company, then Branch, Faculty, Department, Degree and Semester for the chosen company.</summary>
[ApiController]
[Route("api/filters")]
public sealed class FiltersController(DashboardDb db) : ControllerBase
{
    [HttpGet("companies")]
    public Task<IReadOnlyList<Dictionary<string, object?>>> Companies(CancellationToken ct) =>
        db.SectionRowsAsync("Companies", ct: ct);

    [HttpGet("branches")]
    public Task<IReadOnlyList<Dictionary<string, object?>>> Branches([FromQuery] int companyId, CancellationToken ct) =>
        db.SectionRowsAsync("Branches", new { CompanyId = companyId }, ct);

    [HttpGet("faculties")]
    public Task<IReadOnlyList<Dictionary<string, object?>>> Faculties([FromQuery] int companyId, CancellationToken ct) =>
        db.SectionRowsAsync("Faculties", new { CompanyId = companyId }, ct);

    /// <summary>Departments of a company; facultyId missing = all.</summary>
    [HttpGet("departments")]
    public Task<IReadOnlyList<Dictionary<string, object?>>> Departments([FromQuery] int companyId, [FromQuery] string? facultyId, CancellationToken ct) =>
        db.SectionRowsAsync("Departments", new { CompanyId = companyId, FacultyId = DashboardDb.ParseGuid(facultyId) }, ct);

    /// <summary>Degrees of a company; branchId / departmentId 0 or missing = all, facultyId missing = all.</summary>
    [HttpGet("degrees")]
    public Task<IReadOnlyList<Dictionary<string, object?>>> Degrees(
        [FromQuery] int companyId,
        [FromQuery] int branchId,
        [FromQuery] string? facultyId,
        [FromQuery] int departmentId,
        CancellationToken ct) =>
        db.SectionRowsAsync("Degrees", new
        {
            CompanyId = companyId,
            BranchId = branchId,
            FacultyId = DashboardDb.ParseGuid(facultyId),
            DepartmentId = departmentId,
        }, ct);

    /// <summary>Semesters of a company; branchId 0 or missing = all.</summary>
    [HttpGet("semesters")]
    public Task<IReadOnlyList<Dictionary<string, object?>>> Semesters([FromQuery] int companyId, [FromQuery] int branchId, CancellationToken ct) =>
        db.SectionRowsAsync("Semesters", new { CompanyId = companyId, BranchId = branchId }, ct);
}

using MyUni.API.Data;
using Microsoft.AspNetCore.Mvc;

namespace MyUni.API.Controllers;

/// <summary>Tells a monitor, or a person, whether the API is up and whether it can use the database.</summary>
[ApiController]
[Route("api/health")]
public sealed class HealthController(DashboardDb db) : ControllerBase
{
    /// <summary>The API itself is running. It does not touch the database.</summary>
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "ok" });

    /// <summary>Whether the database is configured and reachable and has the dashboard procedures. Gives no server details.</summary>
    [HttpGet("db")]
    public async Task<IActionResult> Database(CancellationToken ct) => Ok(await db.DiagnoseAsync(ct));
}

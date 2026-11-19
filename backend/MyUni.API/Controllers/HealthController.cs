using Microsoft.AspNetCore.Mvc;

namespace MyUni.API.Controllers;

/// <summary>Tells a monitor, or a person, that the API is up. It does not touch the database.</summary>
[ApiController]
[Route("api/health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "ok" });
}

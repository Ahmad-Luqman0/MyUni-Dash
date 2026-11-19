using MyUni.API.Data;
using Microsoft.AspNetCore.Diagnostics;

namespace MyUni.API;

public static class Program
{
    public static void Main(string[] args) =>
        Host.CreateDefaultBuilder(args).ConfigureWebHostDefaults(web => web.UseStartup<Startup>()).Build().Run();
}

/// <summary>Startup in the .NET 5 style (no minimal hosting), so the same code runs on the server's .NET 5 and on newer runtimes.</summary>
public sealed class Startup(IConfiguration config)
{
    public void ConfigureServices(IServiceCollection services)
    {
        services.AddControllers();
        services.AddSingleton<DashboardDb>();

        var origins = config.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
    }

    public void Configure(IApplicationBuilder app)
    {
        // Any unhandled error (a failed procedure, an unreachable database) becomes a plain 500 with no details in the body.
        app.UseExceptionHandler(errors => errors.Run(async context =>
        {
            var error = context.Features.Get<IExceptionHandlerFeature>()?.Error;
            if (error is not null)
                context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Dashboard").LogError(error, "Request failed: {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/problem+json";
            await context.Response.WriteAsync("{\"title\":\"An error occurred while processing your request.\",\"status\":500}");
        }));

        app.UseRouting();
        app.UseCors();
        app.UseEndpoints(endpoints => endpoints.MapControllers());
    }
}

using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;

namespace MyUni.API.Data;

/// <summary>
/// Runs the dashboard procedures of the SP's folder (dbo.Dashboard_MyUni_*): one per filter list and one per portion.
/// Each name maps to its procedure, and only the parameters that procedure declares are sent.
/// </summary>
public sealed class DashboardDb(IConfiguration config)
{
    /// <summary>Where a list or portion lives: its procedure, the parameters it takes, and whether it also takes @RequireApproved.</summary>
    private sealed record Target(string Procedure, string[] Parameters, bool SendsRequireApproved = false, bool SendsSection = false);

    private const string FiltersProcedure = "dbo.Dashboard_MyUni_Filters";

    private static readonly string[] Common = ["CompanyId", "BranchId", "FacultyId", "DepartmentId", "DegreeId", "SemesterId", "StartDate", "EndDate"];

    private static readonly Dictionary<string, Target> Targets = new(StringComparer.OrdinalIgnoreCase)
    {
        // Filter lists: one procedure, the list picked by @Section
        ["Companies"] = new(FiltersProcedure, [], SendsSection: true),
        ["Branches"] = new(FiltersProcedure, ["CompanyId"], SendsSection: true),
        ["Faculties"] = new(FiltersProcedure, ["CompanyId"], SendsSection: true),
        ["Departments"] = new(FiltersProcedure, ["CompanyId", "FacultyId"], SendsSection: true),
        ["Degrees"] = new(FiltersProcedure, ["CompanyId", "BranchId", "FacultyId", "DepartmentId"], SendsSection: true),
        ["Semesters"] = new(FiltersProcedure, ["CompanyId", "BranchId"], SendsSection: true),
        ["EmployeeDepartments"] = new(FiltersProcedure, ["CompanyId", "BranchId"], SendsSection: true),

        // Data portions
        ["Summary"] = new("dbo.Dashboard_MyUni_StudentSummary", Common, SendsRequireApproved: true),
        ["Registrations"] = new("dbo.Dashboard_MyUni_Registrations", Common),
        ["Admissions"] = new("dbo.Dashboard_MyUni_Admissions", Common),
        ["Collections"] = new("dbo.Dashboard_MyUni_Collections", Common, SendsRequireApproved: true),
        ["Receivables"] = new("dbo.Dashboard_MyUni_Receivables", Common),
        ["Defaulters"] = new("dbo.Dashboard_MyUni_Defaulters", Common),
        ["Installments"] = new("dbo.Dashboard_MyUni_Installments", Common),
        ["Discounts"] = new("dbo.Dashboard_MyUni_Discounts", Common),

        // HR portions: only CompanyId, BranchId, DepartmentId and the dates matter to them
        ["Employees"] = new("dbo.Dashboard_MyUni_Employees", Common),
        ["SalaryStructure"] = new("dbo.Dashboard_MyUni_SalaryStructure", Common),
        ["SalarySheet"] = new("dbo.Dashboard_MyUni_SalarySheet", Common),
        ["Attendance"] = new("dbo.Dashboard_MyUni_Attendance", Common),
    };

    // Read once at start-up. A missing value is reported when a request needs it (and by DiagnoseAsync), not at
    // start-up, so the health addresses still answer.
    private readonly string? _configuredConnection = config.GetConnectionString("DefaultConnection");

    private string ConnectionString => string.IsNullOrWhiteSpace(_configuredConnection)
        ? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is missing (copy appsettings.example.json to appsettings.json).")
        : _configuredConnection;

    private readonly int _timeoutSeconds = config.GetValue("Database:CommandTimeoutSeconds", 120);

    /// <summary>Database:RequireApprovedReceipts (default true). false also counts receipts that are not approved; only for a test database.</summary>
    private readonly bool _requireApproved = config.GetValue("Database:RequireApprovedReceipts", true);

    /// <summary>True when the name is one the dashboard procedures serve.</summary>
    public static bool IsSection(string section) => Targets.ContainsKey(section);

    /// <summary>
    /// Runs a list or portion and returns its rows as name/value maps (keys camelCased).
    /// args: an object whose properties are matched by name against the parameters the procedure declares.
    /// </summary>
    public async Task<IReadOnlyList<Dictionary<string, object?>>> SectionRowsAsync(string section, object? args = null, CancellationToken ct = default)
    {
        if (!Targets.TryGetValue(section, out var target))
            throw new ArgumentException($"Unknown section '{section}'.", nameof(section));

        // Send only what this procedure declares: SQL Server rejects a parameter the procedure does not have.
        var parameters = new DynamicParameters();
        if (args is not null)
        {
            foreach (var property in args.GetType().GetProperties())
            {
                if (!target.Parameters.Contains(property.Name, StringComparer.OrdinalIgnoreCase)) continue;
                // Typed explicitly so that a null still goes as the right SQL type.
                var type = Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType;
                DbType? dbType = type == typeof(Guid) ? DbType.Guid
                    : type == typeof(DateTime) ? DbType.Date
                    : type == typeof(int) ? DbType.Int32
                    : null;
                parameters.Add(property.Name, property.GetValue(args), dbType);
            }
        }
        if (target.SendsSection) parameters.Add("Section", section, DbType.AnsiString, size: 30);
        if (target.SendsRequireApproved) parameters.Add("RequireApproved", _requireApproved, DbType.Boolean);

        await using var connection = new SqlConnection(ConnectionString);
        var rows = (await connection.QueryAsync(new CommandDefinition(
            target.Procedure, parameters, commandType: CommandType.StoredProcedure,
            commandTimeout: _timeoutSeconds, cancellationToken: ct))).AsList();

        var list = new List<Dictionary<string, object?>>(rows.Count);
        foreach (IDictionary<string, object?> row in rows)
        {
            var d = new Dictionary<string, object?>(row.Count);
            foreach (var (k, v) in row)
                d[k.Length > 0 ? char.ToLowerInvariant(k[0]) + k[1..] : k] = v is DBNull ? null : v;
            list.Add(d);
        }
        return list;
    }

    /// <summary>A guid from the query string; empty or malformed counts as missing (= all).</summary>
    public static Guid? ParseGuid(string? value) => Guid.TryParse(value, out var id) ? id : null;

    /// <summary>
    /// Says why the database part is or is not working, for /api/health/db. It gives the kind of problem only:
    /// no server name, login, password or error text leaves the server.
    /// </summary>
    public async Task<object> DiagnoseAsync(CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_configuredConnection))
            return new { database = "not configured", detail = "ConnectionStrings:DefaultConnection is missing or empty in appsettings.json (check the file is in the site folder and is valid JSON)." };

        var expected = Targets.Values.Select(t => t.Procedure.Replace("dbo.", "")).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(n => n).ToArray();
        try
        {
            await using var connection = new SqlConnection(_configuredConnection);
            await connection.OpenAsync(ct);
            var found = (await connection.QueryAsync<string>(new CommandDefinition(
                "SELECT name FROM sys.procedures WHERE schema_id = SCHEMA_ID('dbo') AND name IN @names",
                new { names = expected }, commandTimeout: 15, cancellationToken: ct))).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missing = expected.Where(n => !found.Contains(n)).ToArray();
            return new
            {
                database = "connected",
                procedures = $"{found.Count} of {expected.Length} found",
                detail = missing.Length == 0
                    ? "Everything the dashboard needs is in place."
                    : "Some procedures are missing from this database, or this login may not run them. Run all.txt on the database the connection string names.",
                missing,
            };
        }
        catch (SqlException e)
        {
            var kind = e.Number switch
            {
                18456 => "login failed: the user name or password in the connection string is wrong",
                4060 => "the login worked but the database named in the connection string cannot be opened",
                229 or 230 or 297 => "this login is not permitted to read what the check needs",
                233 => "the SQL Server accepted the connection and then dropped it during login: usually the server takes Windows logins only (SQL Server authentication is off), the Server value points at a different instance than intended, or the login's default database is unavailable. The SQL Server error log has the exact reason",
                -2 or -1 or 0 or 2 or 53 or 258 or 1225 or 10053 or 10054 or 10060 or 10061 or 11001 => "the SQL Server cannot be reached: check the server name, port and firewall in the connection string",
                _ => "the SQL Server answered with an error",
            };
            return new { database = "failed", detail = kind, sqlErrorNumber = e.Number };
        }
        catch (Exception e) when (e is ArgumentException or FormatException or InvalidOperationException)
        {
            return new { database = "failed", detail = "the connection string in appsettings.json is not written correctly (a keyword or value in it is not understood)." };
        }
    }
}

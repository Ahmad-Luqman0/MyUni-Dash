// Helper for checking tables and testing queries against the test database (raw SQL runs as-is, so keep it to SELECTs).
// Connection comes from ../../.env (git-ignored).
//
//   npm run db -- tables [filter]        list tables (optionally name LIKE %filter%)
//   npm run db -- columns <table>        columns of one table
//   npm run db -- procs [filter]         list stored procedures
//   npm run db -- "SELECT TOP 10 * FROM dbo.Company"
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
const env = process.env;

const [cmd, arg] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: npm run db -- tables [filter] | columns <table> | procs [filter] | "<SQL>"');
  process.exit(1);
}

const like = (v) => `%${v ?? ''}%`;
const presets = {
  tables: ["SELECT s.name AS [schema], t.name AS [table], SUM(p.rows) AS [rows] FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1) WHERE t.name LIKE @p GROUP BY s.name, t.name ORDER BY s.name, t.name", like(arg)],
  columns: ["SELECT c.column_id AS [#], c.name AS [column], ty.name AS [type], c.max_length AS [len], c.is_nullable AS [null] FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID(@p) ORDER BY c.column_id", arg],
  procs: ["SELECT SCHEMA_NAME(schema_id) AS [schema], name, modify_date FROM sys.procedures WHERE name LIKE @p ORDER BY name", like(arg)],
};

const pool = await sql.connect({
  server: env.DB_SERVER,
  port: Number(env.DB_PORT || 1433),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE,
  options: { encrypt: env.DB_ENCRYPT === 'true', trustServerCertificate: env.DB_TRUST_CERT !== 'false' },
  connectionTimeout: 15000,
  requestTimeout: 120000,
});

try {
  const req = pool.request();
  let text = cmd;
  if (presets[cmd]) {
    [text] = presets[cmd];
    req.input('p', sql.NVarChar, presets[cmd][1]);
  }
  const r = await req.query(text);
  for (const set of r.recordsets.length ? r.recordsets : [[]]) console.table(set);
  console.log(`${env.DB_DATABASE}: ${r.rowsAffected.join(', ')} row(s)`);
} catch (err) {
  console.error(`SQL error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.close();
}

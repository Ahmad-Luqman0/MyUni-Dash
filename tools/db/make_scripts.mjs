// Builds all.txt (SSMS, with GO) and mac.txt (DBeaver on Mac, no GO) from the SP's folder.
// Run: node tools/db/make_scripts.mjs   (writes files only; it does not touch the database)
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const dir = root + "SP's/"
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

const procs = files.map((f) => {
  const text = fs.readFileSync(dir + f, 'utf8')
  const batches = text.split(/^GO\s*$/m).map((b) => b.trim())
  const create = batches.find((b) => b.startsWith('CREATE PROCEDURE'))
  const name = create.match(/CREATE PROCEDURE (\S+)/)[1]
  const comments = text.slice(0, text.search(/^USE /m)).split('\n').filter((l) => l.startsWith('--') && !l.includes('Check the USE line')).join('\n')
  return { name, comments, create }
})
// Procedures an earlier version created and the dashboard no longer calls: both scripts drop them.
const retired = ['CompanyList', 'BranchList', 'FacultyList', 'DepartmentList', 'DegreeList', 'SemesterList'].map((n) => `dbo.Dashboard_MyUni_${n}`)
const dropRetired = `-- Retired: the six filter-list procedures, replaced by dbo.Dashboard_MyUni_Filters.\n` + retired.map((n) => `DROP PROCEDURE IF EXISTS ${n};`).join('\n')

// Pre-check: every table / view column the procedures read (tools/db/requires.json) must exist, or nothing is changed.
// SQL Server creates a procedure even when a table it reads is missing and only fails when it runs, so the scripts check first.
const requires = JSON.parse(fs.readFileSync(root + 'tools/db/requires.json', 'utf8'))
const pairs = Object.entries(requires).flatMap(([obj, cols]) => cols.map((c) => `(N'${obj}', N'${c}')`))
const rows = []
for (let i = 0; i < pairs.length; i += 4) rows.push('        ' + pairs.slice(i, i + 4).join(', '))
const check = `DECLARE @Missing NVARCHAR(MAX) = N'';
SELECT @Missing = @Missing + N', ' + R.Obj + N'.' + R.Col
FROM (VALUES
${rows.join(',\n')}
     ) R(Obj, Col)
WHERE COL_LENGTH(N'dbo.' + R.Obj, R.Col) IS NULL;
IF @Missing <> N''
BEGIN
    SET @Missing = STUFF(@Missing, 1, 2, N'');
    RAISERROR(N'MyUni dashboard: this database is missing %s', 16, 1, @Missing);`

const use = fs.readFileSync(dir + files[0], 'utf8').match(/^USE\s+[^;]+;/m)[0]

const head = (extra) => `-- MYUNI DASHBOARD: ${procs.length} procedures, one for the filter lists and one per tab of the dashboard (dbo.Dashboard_MyUni_*).
-- They only read the ERP tables: they call no other procedure and change no table.
-- Safe to run again: it drops and re-creates only these procedures.
${extra}
-- Generated from the SP's folder by tools/db/make_scripts.mjs; edit the files there, not this one.
`

fs.writeFileSync(root + 'all.txt', head(`-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver on Mac: use mac.txt).`) + `
${use}
GO

-- Pre-check: the tables, views and columns the procedures read must all exist in this database.
-- If one is missing, an error names it and the rest of the script is skipped, so nothing is changed.
SET NOEXEC OFF;
GO
${check}
    SET NOEXEC ON;
END
GO

${dropRetired}
GO
` + procs.map((p) => `
${p.comments}
DROP PROCEDURE IF EXISTS ${p.name};
GO
${p.create}
GO
`).join('') + `
SET NOEXEC OFF;
GO
`)

// DBeaver has no GO: each procedure is created through EXEC (N'...'), so the whole file runs as one batch.
// Blank lines are removed because DBeaver can split a statement on them.
fs.writeFileSync(root + 'mac.txt', head(`-- For DBeaver (Mac), without GO lines. Run it: open in DBeaver, then Execute SQL Script (Option+X),
-- or select all (Cmd+A) and Cmd+Enter. Check the USE line names the right database (live may differ).`) + `
${use}

-- Pre-check: the tables, views and columns the procedures read must all exist in this database.
-- If this statement fails with "this database is missing ...", stop: do not run the rest on this database.
EXEC (N'${check.replaceAll("'", "''")}
END');

${dropRetired}
` + procs.map((p) => `
${p.comments}
DROP PROCEDURE IF EXISTS ${p.name};
EXEC (N'${p.create.split('\n').filter((l) => l.trim()).join('\n').replaceAll("'", "''")}');
`).join(''))

console.log(`all.txt and mac.txt written: ${procs.map((p) => p.name.replace('dbo.Dashboard_MyUni_', '')).join(', ')}`)

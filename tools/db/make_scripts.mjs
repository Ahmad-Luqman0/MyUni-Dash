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
const use = fs.readFileSync(dir + files[0], 'utf8').match(/^USE\s+[^;]+;/m)[0]

const head = (extra) => `-- MYUNI DASHBOARD: ${procs.length} procedures, one per portion of the dashboard (dbo.Dashboard_MyUni_*).
-- They only read the ERP tables: they call no other procedure and change no table.
${extra}
-- Generated from the SP's folder by tools/db/make_scripts.mjs; edit the files there, not this one.
`

fs.writeFileSync(root + 'all.txt', head(`-- Check the USE line names the right database. Run the whole script (SSMS: F5; DBeaver on Mac: use mac.txt).`) + `
${use}
GO
` + procs.map((p) => `
${p.comments}
DROP PROCEDURE IF EXISTS ${p.name};
GO
${p.create}
GO
`).join(''))

// DBeaver has no GO: each procedure is created through EXEC (N'...'), so the whole file runs as one batch.
// Blank lines are removed because DBeaver can split a statement on them.
fs.writeFileSync(root + 'mac.txt', head(`-- For DBeaver (Mac), without GO lines. Run it: open in DBeaver, then Execute SQL Script (Option+X),
-- or select all (Cmd+A) and Cmd+Enter. Check the USE line names the right database (live may differ).`) + `
${use}
` + procs.map((p) => `
${p.comments}
DROP PROCEDURE IF EXISTS ${p.name};
EXEC (N'${p.create.split('\n').filter((l) => l.trim()).join('\n').replaceAll("'", "''")}');
`).join(''))

console.log(`all.txt and mac.txt written: ${procs.map((p) => p.name.replace('dbo.Dashboard_MyUni_', '')).join(', ')}`)

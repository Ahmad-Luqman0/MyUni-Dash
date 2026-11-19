import type { EmployeeRow } from '../api'
import { count, countShort, dateLabel, nice } from '../format'
import { BarList, Columns, Ledger, SplitBar, Tile } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable } from '../components/ui'
import { SectionSkeleton } from './shared'
import { usePortion, type SectionProps } from './helpers'

/** HR text is often ALL CAPS with stray spaces or line breaks ("SWEEPER ", "SUPPORT\nSTAFF"): tidy it for display. */
function tidy(text: string | null | undefined): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return 'Not specified'
  if (/\s/.test(t)) return nice(t)
  return t.length > 3 && t === t.toUpperCase() ? t[0] + t.slice(1).toLowerCase() : t
}

const THIS_YEAR = new Date().getFullYear()
const UNSPECIFIED = 'var(--ink-3)'
/** Colour follows the kind of employment, whatever its rank. Anything else is counted as "Other". */
const STATUS_COLOR: Record<string, string> = { Permanent: C.s1, Contract: C.s2, Visiting: C.s3, Probationary: C.s4, 'Daily Wages': C.s5 }
const GENDER_COLOR: Record<string, string> = { Male: C.s1, Female: C.s2 }

/** Head count of each named group, in the order of `known`, with everything else gathered into one last part. */
function parts(rows: EmployeeRow[], value: (r: EmployeeRow) => string | null, known: Record<string, string>, otherLabel: string) {
  const names = Object.keys(known)
  const find = (r: EmployeeRow) => { const v = tidy(value(r)).toLowerCase(); return names.find((n) => n.toLowerCase() === v) }
  const out = names.map((n) => ({ label: n, value: rows.filter((r) => find(r) === n).length, color: known[n] })).filter((p) => p.value > 0)
  const other = rows.filter((r) => !find(r)).length
  return other > 0 ? [...out, { label: otherLabel, value: other, color: UNSPECIFIED }] : out
}

/** Head count per group, largest first. */
function tally(rows: EmployeeRow[], key: (r: EmployeeRow) => string) {
  const map = new Map<string, number>()
  for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + 1)
  return [...map].map(([label, n]) => ({ key: label, label, values: [n] })).sort((a, b) => b.values[0] - a.values[0])
}

const people = (n: number) => `${count(n)} ${n === 1 ? 'employee' : 'employees'}`

const columns: Column<EmployeeRow>[] = [
  { key: 'code', header: 'Code', cell: (r) => r.code?.trim() || '–', sort: (r) => r.code ?? '', nowrap: true },
  { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{tidy(r.name)}</span>, sort: (r) => tidy(r.name), nowrap: true },
  { key: 'designation', header: 'Designation', cell: (r) => tidy(r.designation), sort: (r) => tidy(r.designation), nowrap: true },
  { key: 'department', header: 'Department', cell: (r) => <span className="block min-w-40">{tidy(r.department)}</span>, sort: (r) => tidy(r.department) },
  { key: 'employment', header: 'Employment', cell: (r) => tidy(r.employmentStatus), sort: (r) => tidy(r.employmentStatus), nowrap: true },
  { key: 'branch', header: 'Campus', cell: (r) => tidy(r.branch), sort: (r) => tidy(r.branch), nowrap: true },
  { key: 'hired', header: 'Hired on', cell: (r) => dateLabel(r.hiringDate), sort: (r) => r.hiringDate ?? '', nowrap: true },
  {
    key: 'status', header: 'Status', sort: (r) => (r.isActive ? 'Active' : `Left ${r.discontinuationDate ?? ''}`), nowrap: true,
    cell: (r) => r.isActive ? 'Active' : <span className="text-ink-2">Left{r.discontinuationDate ? ` ${dateLabel(r.discontinuationDate)}` : ''}</span>,
  },
]

export function Employees({ q, reload }: SectionProps) {
  const state = usePortion<EmployeeRow>('employees', q, reload)
  return (
    <Loadable state={state} noun="employees" skeleton={<SectionSkeleton />}>
      {(rows) => {
        const active = rows.filter((r) => r.isActive)
        const gone = rows.length - active.length

        // Joiners and leavers are counted here, not by the server: within the chosen dates, or this calendar year when none are chosen.
        const dated = Boolean(q?.startDate || q?.endDate)
        const from = dated ? q?.startDate : `${THIS_YEAR}-01-01`, to = dated ? q?.endDate : null
        const inPeriod = (d: string | null) => d !== null && (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to)
        const joined = rows.filter((r) => inPeriod(r.hiringDate)).length
        const left = rows.filter((r) => inPeriod(r.discontinuationDate)).length
        const period = dated ? 'in the period' : 'this year'
        const periodNote = dated
          ? `${from ? `From ${dateLabel(from)}` : 'Up'} ${to ? `to ${dateLabel(to)}` : 'to today'}`
          : `Since 1 Jan ${THIS_YEAR}, as no dates are chosen`

        const departments = tally(active, (r) => tidy(r.department))
        const roles = tally(active, (r) => tidy(r.designation))
        const years = tally(rows.filter((r) => r.hiringDate), (r) => r.hiringDate!.slice(0, 4)).sort((a, b) => a.key.localeCompare(b.key))
        return (
          <div className="space-y-4">
            <Ledger cols={4}>
              <Tile label="Active employees" value={count(active.length)} note={gone > 0 ? `${count(gone)} more have left and stay on record` : 'Currently employed'} />
              <Tile label={`Joined ${period}`} value={count(joined)} note={periodNote} />
              <Tile label={`Left ${period}`} value={count(left)} note={periodNote} />
              <Tile label="Departments staffed" value={count(departments.length)} note={departments[0] ? `Largest: ${departments[0].label}, ${people(departments[0].values[0])}` : undefined} />
            </Ledger>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Head count by department" subtitle="Active employees">
                <BarList format={count} max={12} series={[{ label: 'Employees', color: C.s1 }]} rows={departments} />
              </Card>
              <div className="grid content-start gap-4">
                <Card title="Type of employment" subtitle="Active employees">
                  <SplitBar format={count} parts={parts(active, (r) => r.employmentStatus, STATUS_COLOR, 'Other or not specified')} />
                </Card>
                <Card title="Men and women" subtitle="Active employees">
                  <SplitBar format={count} parts={parts(active, (r) => r.gender, GENDER_COLOR, 'Not specified')} />
                </Card>
              </div>
              <Card title="Most common designations" subtitle={`Active employees, ${count(roles.length)} ${roles.length === 1 ? 'designation' : 'designations'} in all`}>
                <BarList format={count} max={8} otherLabel="Other designations" series={[{ label: 'Employees', color: C.s1 }]} rows={roles} />
              </Card>
              <Card title="Hiring by year" subtitle="Everyone on record by the year they joined, including those who have since left">
                <Columns name="Employees hired each year" format={count} axisFormat={countShort} series={[{ key: 'hired', label: 'Hired', color: C.s1 }]}
                  data={years.map((y) => ({ label: y.key, title: `Hired in ${y.key}`, hired: y.values[0] }))} />
              </Card>
            </div>

            <Card title="Employees" subtitle="Everyone on record, including those who have left. Select a column heading to sort">
              <DataTable caption="Employees" columns={columns} rows={rows} rowKey={(r) => String(r.employeeId)} pageSize={12}
                initialSort={{ key: 'hired', dir: 'desc' }}
                search={(r) => `${r.code} ${r.name} ${r.designation} ${r.department} ${r.employmentStatus ?? ''} ${r.branch ?? ''} ${r.isActive ? 'Active' : 'Left'}`}
                searchLabel="Search by name, code, designation or department" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

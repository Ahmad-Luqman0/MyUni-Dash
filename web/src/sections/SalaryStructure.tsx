import type { SalaryStructureRow } from '../api'
import { rollup, sum } from '../useData'
import { count, countShort, dateLabel, nice, rs, rsShort } from '../format'
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

/** Monthly gross salary bands in PKR. Each band runs up to, but not including, `below`. */
const BANDS = [
  { label: 'Under 50K', title: 'Under Rs 50,000 a month', below: 50_000 },
  { label: '50–100K', title: 'Rs 50,000 to under Rs 100,000 a month', below: 100_000 },
  { label: '100–150K', title: 'Rs 100,000 to under Rs 150,000 a month', below: 150_000 },
  { label: '150–250K', title: 'Rs 150,000 to under Rs 250,000 a month', below: 250_000 },
  { label: '250K+', title: 'Rs 250,000 a month or more', below: Infinity },
]

const allowances = (r: SalaryStructureRow) => r.specialAllowance + r.totalAllowance
const people = (n: number) => `${count(n)} ${n === 1 ? 'employee' : 'employees'}`

const columns: Column<SalaryStructureRow>[] = [
  { key: 'code', header: 'Code', cell: (r) => r.code?.trim() || '–', sort: (r) => r.code ?? '', nowrap: true },
  { key: 'name', header: 'Name', cell: (r) => <span className="font-medium">{tidy(r.name)}</span>, sort: (r) => tidy(r.name), nowrap: true },
  { key: 'designation', header: 'Designation', cell: (r) => tidy(r.designation), sort: (r) => tidy(r.designation), nowrap: true },
  { key: 'department', header: 'Department', cell: (r) => <span className="block min-w-40">{tidy(r.department)}</span>, sort: (r) => tidy(r.department) },
  {
    key: 'basic', header: 'Basic', sort: (r) => r.basicSalary, align: 'right',
    cell: (r) => <>{rs(r.basicSalary)}{r.ratePerDay > 0 && <span className="block text-xs text-ink-3">{rs(r.ratePerDay)} a day</span>}</>,
  },
  { key: 'allowances', header: 'Allowances', cell: (r) => rs(allowances(r)), sort: allowances, align: 'right' },
  { key: 'gross', header: 'Gross', cell: (r) => <span className="font-medium">{rs(r.grossSalary)}</span>, sort: (r) => r.grossSalary, align: 'right' },
  { key: 'effective', header: 'Effective from', cell: (r) => dateLabel(r.effectiveDate), sort: (r) => r.effectiveDate ?? '', nowrap: true },
]

export function SalaryStructure({ q, reload }: SectionProps) {
  const state = usePortion<SalaryStructureRow>('salaryStructure', q, reload)
  return (
    <Loadable state={state} noun="salary structures" skeleton={<SectionSkeleton />}>
      {(rows) => {
        const gross = sum(rows, (r) => r.grossSalary)
        const ranked = [...rows].sort((a, b) => a.grossSalary - b.grossSalary)
        const middle = ranked.length % 2 ? ranked[(ranked.length - 1) / 2].grossSalary : (ranked[ranked.length / 2 - 1].grossSalary + ranked[ranked.length / 2].grossSalary) / 2
        const top = ranked[ranked.length - 1]
        const departments = rollup(rows, (r) => tidy(r.department), ['grossSalary'])
        const staffIn = (department: string) => rows.filter((r) => tidy(r.department) === department).length
        return (
          <div className="space-y-4">
            <Ledger cols={4}>
              <Tile label="Employees with a structure" value={count(rows.length)} note={`In ${count(departments.length)} ${departments.length === 1 ? 'department' : 'departments'}`} />
              <Tile label="Total monthly gross" value={rsShort(gross)} full={rs(gross)} note={`${rsShort(gross * 12)} over a year`} />
              <Tile label="Average gross" value={rsShort(gross / rows.length)} full={rs(gross / rows.length)} note={`Half earn ${rs(middle)} or less a month`} />
              <Tile label="Highest gross" value={rsShort(top.grossSalary)} full={rs(top.grossSalary)} note={`${tidy(top.name)}, ${tidy(top.designation)}`} />
            </Ledger>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Monthly gross by department" subtitle="What the current structures add up to each month">
                <BarList format={rs} max={12} series={[{ label: 'Monthly gross', color: C.s1 }]}
                  rows={departments.map((g) => ({ key: g.key, label: g.key, values: [g.grossSalary], note: people(staffIn(g.key)) }))} />
              </Card>
              <div className="grid content-start gap-4">
                <Card title="Basic pay and allowances" subtitle="What the monthly gross is made of">
                  <SplitBar format={rs} parts={[
                    { label: 'Basic pay', value: sum(rows, (r) => r.basicSalary), color: C.s1 },
                    { label: 'Special allowance', value: sum(rows, (r) => r.specialAllowance), color: C.s2 },
                    { label: 'Other allowances', value: sum(rows, (r) => r.totalAllowance), color: C.s4 },
                  ].filter((p, i) => i === 0 || p.value > 0)} />
                </Card>
                <Card title="Employees by salary band" subtitle="Monthly gross salary in rupees">
                  <Columns name="Employees in each monthly gross salary band" format={count} axisFormat={countShort} height={300}
                    series={[{ key: 'employees', label: 'Employees', color: C.s1 }]}
                    data={BANDS.map((b, i) => ({
                      label: b.label, title: b.title,
                      employees: rows.filter((r) => r.grossSalary < b.below && (i === 0 || r.grossSalary >= BANDS[i - 1].below)).length,
                    }))} />
                </Card>
              </div>
            </div>

            <Card title="Salary structures" subtitle="One row per employee. Select a column heading to sort">
              <DataTable caption="Salary structures" columns={columns} rows={rows} rowKey={(r) => String(r.employeeId)}
                initialSort={{ key: 'gross', dir: 'desc' }}
                search={(r) => `${r.code} ${r.name} ${r.designation} ${r.department}`} searchLabel="Search by name, code, designation or department" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

import type { SalarySheetRow } from '../api'
import { rollup } from '../useData'
import { count, monthLabel, nice, pct, rs, rsShort } from '../format'
import { BarList, Ledger, SplitBar, Tile, TrendArea } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable } from '../components/ui'
import { SectionSkeleton } from './shared'
import { monthKey, usePortion, type SectionProps } from './helpers'

const FIELDS = ['employees', 'basicSalary', 'allowances', 'grossSalary', 'deductions', 'loans', 'incomeTax', 'eobi', 'providentFund', 'netPay'] satisfies (keyof SalarySheetRow)[]
type Line = ReturnType<typeof rollup<SalarySheetRow, (typeof FIELDS)[number]>>[number]

/** Everything taken off gross pay before it reaches the employee. */
const withheld = (r: Pick<SalarySheetRow, 'deductions' | 'loans' | 'incomeTax' | 'eobi' | 'providentFund'>) => r.deductions + r.loans + r.incomeTax + r.eobi + r.providentFund

const columns: Column<Line>[] = [
  { key: 'month', header: 'Month', cell: (r) => monthLabel(r.first.month), sort: (r) => r.first.month, nowrap: true },
  { key: 'department', header: 'Department', cell: (r) => <span className="block min-w-40">{nice(r.first.department)}</span>, sort: (r) => nice(r.first.department) },
  { key: 'employees', header: 'Employees', cell: (r) => count(r.employees), sort: (r) => r.employees, align: 'right' },
  { key: 'basic', header: 'Basic', cell: (r) => rs(r.basicSalary), sort: (r) => r.basicSalary, align: 'right' },
  { key: 'allowances', header: 'Allowances', cell: (r) => rs(r.allowances), sort: (r) => r.allowances, align: 'right' },
  { key: 'gross', header: 'Gross', cell: (r) => rs(r.grossSalary), sort: (r) => r.grossSalary, align: 'right' },
  { key: 'withheld', header: 'Deductions', cell: (r) => rs(withheld(r)), sort: withheld, align: 'right' },
  { key: 'tax', header: 'Income tax', cell: (r) => rs(r.incomeTax), sort: (r) => r.incomeTax, align: 'right' },
  { key: 'net', header: 'Net pay', cell: (r) => rs(r.netPay), sort: (r) => r.netPay, align: 'right' },
]

export function SalarySheet({ q, reload }: SectionProps) {
  const state = usePortion<SalarySheetRow>('salarySheet', q, reload)
  return (
    <Loadable state={state} noun="salary sheets" skeleton={<SectionSkeleton tiles={6} cols={3} />}>
      {(rows) => {
        const t = rollup(rows, () => 'all', FIELDS)[0]
        const off = withheld(t)
        const months = rollup(rows, (r) => monthKey(r.month), FIELDS).sort((a, b) => a.key.localeCompare(b.key))
        // The same people are paid every month, so head counts come from one month: the latest in view.
        const last = months[months.length - 1]
        const lastName = monthLabel(last.key)
        const lastRows = rows.filter((r) => monthKey(r.month) === last.key)
        const staffByDept = new Map(rollup(lastRows, (r) => r.department ?? '', ['employees']).map((g) => [g.key, g.employees]))
        const span = months.length > 1 ? `${monthLabel(months[0].key)} to ${lastName}` : lastName
        const lines = rollup(rows, (r) => `${monthKey(r.month)}|${r.department ?? ''}`, FIELDS)
        return (
          <div className="space-y-4">
            <Ledger cols={3}>
              <Tile label="Net pay" value={rsShort(t.netPay)} full={rs(t.netPay)} note={`Paid to employees, ${span}`} />
              <Tile label="Gross pay" value={rsShort(t.grossSalary)} full={rs(t.grossSalary)} note={`${months.length} ${months.length === 1 ? 'month' : 'months'} of payroll`} />
              <Tile label="Deductions" value={rsShort(off)} full={rs(off)} note={`${pct(off, t.grossSalary)} of gross: tax, EOBI, provident fund, loans and others`} />
              <Tile label={`Employees paid in ${lastName}`} value={count(last.employees)} note={months.length > 1 ? `Latest of ${months.length} months in view` : 'The month in view'} />
              <Tile label="Average net pay per employee" value={last.employees > 0 ? rsShort(last.netPay / last.employees) : '–'}
                full={last.employees > 0 ? rs(last.netPay / last.employees) : undefined} note={`${lastName}, ${rsShort(last.netPay)} net pay`} />
              <Tile label="Income tax withheld" value={rsShort(t.incomeTax)} full={rs(t.incomeTax)} note={`${pct(t.incomeTax, t.grossSalary)} of gross pay`} />
            </Ledger>

            <Card title="Net pay by month" subtitle="What employees were paid after deductions">
              <TrendArea name="Net pay" format={rs} axisFormat={rsShort} height={284}
                data={months.map((m) => ({ label: monthLabel(m.key), value: m.netPay }))} />
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid content-start gap-4">
                <Card title="Where gross pay goes" subtitle={`Net pay and what is held back, ${span}`}>
                  <SplitBar format={rs} parts={[
                    { label: 'Net pay', color: C.s3, value: t.netPay },
                    { label: 'Income tax', color: C.s1, value: t.incomeTax },
                    { label: 'EOBI and provident fund', color: C.s4, value: t.eobi + t.providentFund, note: `EOBI ${rsShort(t.eobi)}, provident fund ${rsShort(t.providentFund)}` },
                    { label: 'Loan repayments', color: C.s5, value: t.loans },
                    { label: 'Other deductions', color: C.s2, value: t.deductions, note: 'monthly, recurring and absence' },
                  ]} />
                </Card>
                <Card title="What gross pay is made of" subtitle={`Basic salary and allowances, ${span}`}>
                  <SplitBar format={rs} parts={[
                    { label: 'Basic salary', color: C.s1, value: t.basicSalary },
                    { label: 'Allowances', color: C.s2, value: t.allowances },
                  ]} />
                </Card>
              </div>
              <Card title="Net pay by department" subtitle={`Total over ${months.length > 1 ? 'the whole period' : 'the month'}, ${span}; head counts are for ${lastName}`}>
                <BarList format={rs} max={12} series={[{ label: 'Net pay', color: C.s1 }]}
                  rows={rollup(rows, (r) => r.department ?? '', ['netPay']).map((g) => ({
                    key: g.key, label: nice(g.first.department), values: [g.netPay],
                    note: staffByDept.has(g.key) ? `${count(staffByDept.get(g.key)!)} employees` : `No one paid in ${lastName}`,
                  }))} />
              </Card>
            </div>

            <Card title="Salary sheets" subtitle="One row per month and department, all campuses in view together">
              <DataTable caption="Salary sheets" columns={columns} rows={lines} rowKey={(r) => r.key} initialSort={{ key: 'month', dir: 'desc' }}
                search={(r) => `${monthLabel(r.first.month)} ${nice(r.first.department)}`} searchLabel="Search by department or month" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

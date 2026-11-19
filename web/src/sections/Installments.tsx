import type { InstallmentRow } from '../api'
import { rollup, sum } from '../useData'
import { count, monthLabel, pct, rs, rsShort } from '../format'
import { BarList, Columns, Ledger, SplitBar, Tile } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable } from '../components/ui'
import { DegreeCell, SectionSkeleton } from './shared'
import { degreeKey, degreeName, monthKey, usePortion, type SectionProps } from './helpers'

// Paid / Overdue / Upcoming are states, so they keep the same three colours everywhere.
const STATES = [{ key: 'Paid', label: 'Paid', color: C.s1 }, { key: 'Overdue', label: 'Overdue', color: C.bad }, { key: 'Upcoming', label: 'Upcoming', color: C.s3 }]

const columns: Column<InstallmentRow>[] = [
  { key: 'month', header: 'Month', cell: (r) => monthLabel(r.month), sort: (r) => r.month, nowrap: true },
  { key: 'degree', header: 'Degree', cell: (r) => <DegreeCell row={r} />, sort: degreeName },
  { key: 'plan', header: 'Plan status', cell: (r) => r.planStatus, sort: (r) => r.planStatus },
  {
    key: 'state', header: 'State', sort: (r) => r.state, nowrap: true,
    cell: (r) => <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: STATES.find((s) => s.key === r.state)?.color ?? 'var(--ink-3)' }} />{r.state}</span>,
  },
  { key: 'plans', header: 'Plans', cell: (r) => count(r.plans), sort: (r) => r.plans, align: 'right' },
  { key: 'installments', header: 'Installments', cell: (r) => count(r.installments), sort: (r) => r.installments, align: 'right' },
  { key: 'amount', header: 'Amount', cell: (r) => rs(r.amount), sort: (r) => r.amount, align: 'right' },
]

export function Installments({ q, reload }: SectionProps) {
  const state = usePortion<InstallmentRow>('installments', q, reload)
  return (
    <Loadable state={state} noun="installments" skeleton={<SectionSkeleton />}>
      {(rows) => {
        const total = sum(rows, (r) => r.amount)
        const of = (s: string) => rows.filter((r) => r.state === s)
        const months = new Map<string, Record<string, number>>()
        for (const r of rows) {
          const m = months.get(monthKey(r.month)) ?? {}
          m[r.state] = (m[r.state] ?? 0) + r.amount
          months.set(monthKey(r.month), m)
        }
        const plans = rollup(rows, (r) => r.planStatus, ['amount', 'plans'])
        const plan = (k: string) => plans.find((p) => p.key === k)
        return (
          <div className="space-y-4">
            <Ledger cols={4}>
              <Tile label="Installments in view" value={rsShort(total)} full={rs(total)} note={`${count(sum(rows, (r) => r.installments))} installments`} />
              <Tile label="Paid" value={rsShort(sum(of('Paid'), (r) => r.amount))} full={rs(sum(of('Paid'), (r) => r.amount))} note={`${pct(sum(of('Paid'), (r) => r.amount), total)} of the amount`} />
              <Tile alert={of('Overdue').length > 0} label="Overdue" value={rsShort(sum(of('Overdue'), (r) => r.amount))} full={rs(sum(of('Overdue'), (r) => r.amount))}
                note={`${count(sum(of('Overdue'), (r) => r.installments))} installments past their month`} />
              <Tile label="Upcoming" value={rsShort(sum(of('Upcoming'), (r) => r.amount))} full={rs(sum(of('Upcoming'), (r) => r.amount))}
                note={`${count(sum(of('Upcoming'), (r) => r.installments))} installments still to fall due`} />
            </Ledger>

            <Card title="Installments by month" subtitle="Amount falling due each month, split by whether it has been paid">
              <Columns stacked name="Installment amount by month and state" format={rs} axisFormat={rsShort} series={STATES}
                data={[...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: monthLabel(k), ...v }))} />
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Plans approved and pending" subtitle="Installment plans by approval, by amount">
                <SplitBar format={rs} parts={[
                  { label: 'Approved', color: C.s1, value: plan('Approved')?.amount ?? 0, note: `${count(plan('Approved')?.plans ?? 0)} plans` },
                  { label: 'Pending', color: C.s2, value: plan('Pending')?.amount ?? 0, note: `${count(plan('Pending')?.plans ?? 0)} plans` },
                ]} />
              </Card>
              <Card title="Installments by degree" subtitle="Amount on installment plans">
                <BarList format={rs} max={8} series={[{ label: 'Amount', color: C.s1 }]}
                  rows={rollup(rows, degreeKey, ['amount']).map((g) => ({ key: g.key, label: degreeName(g.first), values: [g.amount] }))} />
              </Card>
            </div>

            <Card title="Installments" subtitle="One row per month, degree, plan status and state">
              <DataTable caption="Installments" columns={columns} rows={rows} rowKey={(_, i) => String(i)} initialSort={{ key: 'month', dir: 'desc' }}
                search={(r) => `${monthLabel(r.month)} ${r.degree} ${r.degreeCode} ${r.planStatus} ${r.state}`} searchLabel="Search by degree, month or state" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

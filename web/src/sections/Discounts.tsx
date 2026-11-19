import type { DiscountRow } from '../api'
import { rollup, sum } from '../useData'
import { count, nice, pct, rs, rsShort } from '../format'
import { BarList, Ledger, SplitBar, Tile } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable } from '../components/ui'
import { DegreeCell, SectionSkeleton } from './shared'
import { degreeKey, degreeName, usePortion, type SectionProps } from './helpers'

const columns: Column<DiscountRow>[] = [
  { key: 'type', header: 'Discount type', cell: (r) => <span className="block min-w-48">{nice(r.discountType)}</span>, sort: (r) => r.discountType ?? '' },
  { key: 'category', header: 'Category', cell: (r) => nice(r.category), sort: (r) => r.category ?? '', nowrap: true },
  { key: 'feeType', header: 'Fee type', cell: (r) => nice(r.feeType), sort: (r) => r.feeType ?? '', nowrap: true },
  { key: 'degree', header: 'Degree', cell: (r) => <DegreeCell row={r} />, sort: degreeName },
  { key: 'status', header: 'Status', cell: (r) => r.statusText ?? '–', sort: (r) => r.statusText ?? '' },
  { key: 'students', header: 'Students', cell: (r) => count(r.students), sort: (r) => r.students, align: 'right' },
  { key: 'amount', header: 'Amount', cell: (r) => rs(r.amount), sort: (r) => r.amount, align: 'right' },
]

const PART_COLORS = [C.s1, C.s2, C.s3, C.s4, C.s5]

export function Discounts({ q, reload }: SectionProps) {
  const state = usePortion<DiscountRow>('discounts', q, reload)
  return (
    <Loadable state={state} noun="discounts" skeleton={<SectionSkeleton />}>
      {(rows) => {
        const total = sum(rows, (r) => r.amount), students = sum(rows, (r) => r.students)
        const by = (f: (r: DiscountRow) => string | null) => rollup(rows, (r) => f(r) ?? 'Not specified', ['amount', 'students'])
        const status = by((r) => r.statusText)
        const approved = status.find((s) => s.key === 'Approved')?.amount ?? 0
        const pending = status.find((s) => s.key === 'Pending')?.amount ?? 0
        const types = by((r) => r.discountType).sort((a, b) => b.amount - a.amount)
        // Categories and fee types keep one colour each by name order, so a filter never repaints them.
        const parts = (groups: ReturnType<typeof by>) => [...groups].sort((a, b) => a.key.localeCompare(b.key))
          .slice(0, 5).map((g, i) => ({ label: nice(g.key), value: g.amount, color: PART_COLORS[i], note: `${count(g.students)} students` }))
        return (
          <div className="space-y-4">
            <Ledger cols={4}>
              <Tile label="Discount given" value={rsShort(total)} full={rs(total)} note={`${count(types.length)} discount types`} />
              <Tile label="Students with a discount" value={count(students)} note={`${rs(students > 0 ? total / students : 0)} each on average`} />
              <Tile label="Approved" value={rsShort(approved)} full={rs(approved)} note={`${pct(approved, total)} of the amount`} />
              <Tile label="Pending approval" value={rsShort(pending)} full={rs(pending)} note={pending > 0 ? 'Waiting for a decision' : 'Nothing is waiting'} />
            </Ledger>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="By discount type" subtitle="Scholarships, assistance and policies">
                <BarList format={rs} max={8} series={[{ label: 'Amount', color: C.s1 }]}
                  rows={types.map((g) => ({ key: g.key, label: nice(g.key), values: [g.amount], note: `${count(g.students)} students` }))} />
              </Card>
              <Card title="By degree" subtitle="Discount given to students of each degree">
                <BarList format={rs} max={8} series={[{ label: 'Amount', color: C.s1 }]}
                  rows={rollup(rows, degreeKey, ['amount']).map((g) => ({ key: g.key, label: degreeName(g.first), values: [g.amount] }))} />
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card title="Approved and pending" subtitle="By amount">
                <SplitBar format={rs} parts={[
                  { label: 'Approved', color: C.s1, value: approved, note: `${count(status.find((s) => s.key === 'Approved')?.students ?? 0)} students` },
                  { label: 'Pending', color: C.s2, value: pending, note: `${count(status.find((s) => s.key === 'Pending')?.students ?? 0)} students` },
                ]} />
              </Card>
              <Card title="By category" subtitle="For the whole degree or one semester">
                <SplitBar format={rs} parts={parts(by((r) => r.category))} />
              </Card>
              <Card title="By fee type" subtitle="The fee the discount was taken off">
                <SplitBar format={rs} parts={parts(by((r) => r.feeType))} />
              </Card>
            </div>

            <Card title="Discounts" subtitle="One row per discount type, category, fee type, degree and status">
              <DataTable caption="Discounts" columns={columns} rows={rows} rowKey={(_, i) => String(i)} initialSort={{ key: 'amount', dir: 'desc' }}
                search={(r) => `${r.discountType} ${r.category} ${r.feeType} ${r.degree} ${r.degreeCode} ${r.statusText}`} searchLabel="Search by type, degree or status" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

import type { DefaulterRow } from '../api'
import { rollup, sum } from '../useData'
import { count, dateLabel, nice, rs, rsShort } from '../format'
import { BarList, Ledger, Tile } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable } from '../components/ui'
import { DegreeCell, SectionSkeleton } from './shared'
import { degreeName, usePortion, type SectionProps } from './helpers'

const BUCKETS = [
  { label: '0 to 30 days', test: (d: number) => d <= 30 },
  { label: '31 to 60 days', test: (d: number) => d > 30 && d <= 60 },
  { label: '61 to 90 days', test: (d: number) => d > 60 && d <= 90 },
  { label: 'Over 90 days', test: (d: number) => d > 90 },
]

const columns: Column<DefaulterRow>[] = [
  { key: 'regNo', header: 'Reg no.', cell: (r) => r.regNo ?? '–', sort: (r) => r.regNo ?? '', nowrap: true },
  { key: 'student', header: 'Student', cell: (r) => <span className="font-medium">{nice(r.student)}</span>, sort: (r) => nice(r.student), nowrap: true },
  { key: 'degree', header: 'Degree', cell: (r) => <DegreeCell row={{ ...r, department: r.programType }} />, sort: degreeName },
  { key: 'totalFee', header: 'Total fee', cell: (r) => rs(r.totalFee), sort: (r) => r.totalFee, align: 'right' },
  { key: 'received', header: 'Received', cell: (r) => rs(r.received), sort: (r) => r.received, align: 'right' },
  { key: 'balance', header: 'Balance', cell: (r) => <span className="font-medium">{rs(r.balance)}</span>, sort: (r) => r.balance, align: 'right' },
  {
    key: 'days', header: 'Days overdue', sort: (r) => r.daysOverdue, align: 'right',
    cell: (r) => <span title={r.oldestDueDate ? `Oldest unpaid challan was due ${dateLabel(r.oldestDueDate)}` : undefined}>{count(r.daysOverdue)}</span>,
  },
  { key: 'remarks', header: 'Remarks', cell: (r) => <span className="block max-w-72 min-w-44 text-ink-2">{r.remarks ?? '–'}</span> },
]

export function Defaulters({ q, reload }: SectionProps) {
  const state = usePortion<DefaulterRow>('defaulters', q, reload)
  return (
    <Loadable state={state} noun="defaulters" skeleton={<SectionSkeleton />}>
      {(rows) => {
        const balance = sum(rows, (r) => r.balance)
        const worst = rows.reduce((a, r) => (r.balance > a.balance ? r : a), rows[0])
        const old = rows.filter((r) => r.daysOverdue > 90)
        return (
          <div className="space-y-4">
            <Ledger cols={4}>
              <Tile alert label="Total overdue balance" value={rsShort(balance)} full={rs(balance)} note={`${rs(balance / rows.length)} per student on average`} />
              <Tile label="Defaulters" value={count(rows.length)} note={`${count(sum(rows, (r) => r.unpaidChallans))} unpaid challans between them`} />
              <Tile label="Over 90 days late" value={count(old.length)} note={`${rsShort(sum(old, (r) => r.balance))} of the balance`} />
              <Tile label="Largest balance" value={rsShort(worst.balance)} full={rs(worst.balance)} note={`${nice(worst.student)}, ${count(worst.daysOverdue)} days overdue`} />
            </Ledger>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="How long the balances have been overdue" subtitle="Counted from each student’s oldest unpaid due date">
                <BarList sort={false} format={rs} series={[{ label: 'Balance', color: C.bad }]}
                  rows={BUCKETS.map((b) => {
                    const inBucket = rows.filter((r) => b.test(r.daysOverdue))
                    return { key: b.label, label: b.label, values: [sum(inBucket, (r) => r.balance)], note: `${count(inBucket.length)} ${inBucket.length === 1 ? 'student' : 'students'}` }
                  })} />
              </Card>
              <Card title="Overdue balance by degree" subtitle="Where the unpaid fee sits">
                <BarList format={rs} max={6} series={[{ label: 'Balance', color: C.bad }]}
                  rows={rollup(rows, (r) => r.degreeCode ?? r.degree ?? '', ['balance']).map((g) => ({
                    key: g.key, label: degreeName(g.first), values: [g.balance], note: `${count(rows.filter((r) => (r.degreeCode ?? r.degree ?? '') === g.key).length)} students`,
                  }))} />
              </Card>
            </div>

            <Card title="Students with an overdue balance" subtitle="Select a column heading to sort">
              <DataTable caption="Students with an overdue balance" columns={columns} rows={rows} rowKey={(r) => r.studentId}
                initialSort={{ key: 'balance', dir: 'desc' }}
                search={(r) => `${r.regNo} ${r.student} ${r.degree} ${r.degreeCode} ${r.remarks ?? ''}`} searchLabel="Search by name, reg no. or degree" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

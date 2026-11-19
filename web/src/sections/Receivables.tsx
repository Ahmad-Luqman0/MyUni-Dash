import type { ReceivableRow } from '../api'
import { rollup, sum } from '../useData'
import { count, pct, rs, rsShort } from '../format'
import { BarList, Columns, Ledger, Tile } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable } from '../components/ui'
import { DegreeCell, Quiet, SectionSkeleton } from './shared'
import { challanLabel, degreeKey, degreeName, usePortion, type SectionProps } from './helpers'

const columns: Column<ReceivableRow>[] = [
  { key: 'semester', header: 'Semester', cell: (r) => r.semester ?? '–', sort: (r) => r.semesterStart ?? '', nowrap: true },
  { key: 'degree', header: 'Degree', cell: (r) => <DegreeCell row={r} />, sort: degreeName },
  { key: 'type', header: 'Challan type', cell: (r) => challanLabel(r.challanType), sort: (r) => challanLabel(r.challanType), nowrap: true },
  { key: 'challans', header: 'Challans', cell: (r) => count(r.challans), sort: (r) => r.challans, align: 'right' },
  { key: 'billed', header: 'Billed', cell: (r) => rs(r.billed), sort: (r) => r.billed, align: 'right' },
  { key: 'received', header: 'Received', cell: (r) => rs(r.received), sort: (r) => r.received, align: 'right' },
  { key: 'balance', header: 'Balance', cell: (r) => rs(r.billed - r.received), sort: (r) => r.billed - r.received, align: 'right' },
  { key: 'overdue', header: 'Overdue', cell: (r) => rs(r.overdue), sort: (r) => r.overdue, align: 'right' },
  { key: 'discount', header: 'Discount', cell: (r) => rs(r.discount), sort: (r) => r.discount, align: 'right' },
  { key: 'fine', header: 'Fine', cell: (r) => rs(r.fine), sort: (r) => r.fine, align: 'right' },
]

export function Receivables({ q, reload }: SectionProps) {
  const state = usePortion<ReceivableRow>('receivables', q, reload)
  return (
    <Loadable state={state} noun="receivables" skeleton={<SectionSkeleton tiles={6} cols={3} />}>
      {(rows) => {
        const billed = sum(rows, (r) => r.billed), received = sum(rows, (r) => r.received), overdue = sum(rows, (r) => r.overdue)
        const semesters = rollup(rows, (r) => r.semesterId ?? '', ['billed', 'received']).sort((a, b) => (a.first.semesterStart ?? '').localeCompare(b.first.semesterStart ?? ''))
        const degrees = rollup(rows, degreeKey, ['billed', 'received', 'overdue', 'overdueChallans'])
        const late = degrees.filter((d) => d.overdue > 0)
        return (
          <div className="space-y-4">
            <Ledger cols={3}>
              <Tile label="Fee billed" value={rsShort(billed)} full={rs(billed)} note={`${count(sum(rows, (r) => r.challans))} challans`} />
              <Tile label="Received" value={rsShort(received)} full={rs(received)} note={`${pct(received, billed)} of billed`} />
              <Tile label="Balance" value={rsShort(billed - received)} full={rs(billed - received)} note="Billed and not yet paid" />
              <Tile alert={overdue > 0} label="Overdue" value={rsShort(overdue)} full={rs(overdue)} note={`${count(sum(rows, (r) => r.overdueChallans))} challans past the due date`} />
              <Tile label="Discount given" value={rsShort(sum(rows, (r) => r.discount))} full={rs(sum(rows, (r) => r.discount))} note={`${pct(sum(rows, (r) => r.discount), billed)} of billed`} />
              <Tile label="Fine charged" value={rsShort(sum(rows, (r) => r.fine))} full={rs(sum(rows, (r) => r.fine))} note="Late payment fines" />
            </Ledger>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid content-start gap-4">
                <Card title="Received and balance by semester" subtitle="The two together are the fee billed">
                  {semesters.length > 1
                    ? <Columns stacked name="Received and balance by semester" format={rs} axisFormat={rsShort}
                        series={[{ key: 'received', label: 'Received', color: C.s3 }, { key: 'balance', label: 'Balance', color: C.s2 }]}
                        data={semesters.map((s) => ({ label: s.first.semester ?? '–', received: s.received, balance: Math.max(0, s.billed - s.received) }))} />
                    : <Quiet>Only {semesters[0]?.first.semester ?? 'one semester'} is in view. Choose “All semesters” on the strip above to compare semesters.</Quiet>}
                </Card>
                <Card title="Overdue by degree" subtitle="Unpaid amounts that are past their due date">
                  {late.length > 0
                    ? <BarList format={rs} max={8} series={[{ label: 'Overdue', color: C.bad }]}
                        rows={late.map((g) => ({ key: g.key, label: degreeName(g.first), values: [g.overdue], note: `${count(g.overdueChallans)} challans` }))} />
                    : <Quiet>Nothing is overdue in this view.</Quiet>}
                </Card>
              </div>
              <Card title="Billed and received by degree" subtitle="Fee billed on challans, and how much of it has been paid">
                <BarList format={rsShort} max={12} series={[{ label: 'Billed', color: C.s1 }, { label: 'Received', color: C.s3 }]}
                  rows={degrees.map((g) => ({ key: g.key, label: degreeName(g.first), values: [g.billed, g.received], note: `Balance ${rsShort(g.billed - g.received)}` }))} />
              </Card>
            </div>

            <Card title="Receivables" subtitle="One row per semester, degree and challan type">
              <DataTable caption="Receivables" columns={columns} rows={rows} rowKey={(_, i) => String(i)} initialSort={{ key: 'balance', dir: 'desc' }}
                search={(r) => `${r.semester} ${r.degree} ${r.degreeCode} ${challanLabel(r.challanType)}`} searchLabel="Search by degree, semester or challan type" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

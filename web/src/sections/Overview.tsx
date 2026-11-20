import type { CollectionRow, ReceivableRow, RegistrationRow, SummaryRow } from '../api'
import { rollup, sum } from '../useData'
import { count, monthLabel, pct, rs, rsShort } from '../format'
import { BarList, Ledger, Tile, TrendArea } from '../components/charts'
import { C } from '../palette'
import { Loadable } from '../components/ui'
import { Block, LedgerSkeleton } from './shared'
import { degreeKey, degreeName, latestSemester, monthKey, usePortion, type SectionProps } from './helpers'

export function Overview({ q, reload }: SectionProps) {
  const summary = usePortion<SummaryRow>('summary', q, reload)
  const regs = usePortion<RegistrationRow>('registrations', q, reload)
  const cols = usePortion<CollectionRow>('collections', q, reload)
  const recv = usePortion<ReceivableRow>('receivables', q, reload)
  const latest = regs.data ? latestSemester(regs.data) : null
  const collected = cols.data ? sum(cols.data, (r) => r.amount) : 0

  return (
    <div className="space-y-4">
      <Loadable state={summary} noun="headline figures" skeleton={<LedgerSkeleton tiles={8} cols={4} />}>
        {(rows) => {
          const s = rows[0]
          return (
            <Ledger cols={4}>
              <Tile label="Active students" value={count(s.students)} note={`${count(s.programs)} degree programs`} />
              <Tile label="Registered" value={count(s.registeredStudents)} note={`${count(s.degreeCompleted)} have completed their degree`} />
              <Tile label="New admissions" value={count(s.newAdmissions)} note="Students admitted" />
              <Tile label="Total challan" value={rsShort(s.billed)} full={rs(s.billed)} note={`${rsShort(s.discounts)} given in discounts`} />
              <Tile label="Paid" value={rsShort(s.received)} full={rs(s.received)} note={`${pct(s.received, s.billed)} of total challan`} />
              <Tile label="Unpaid" value={rsShort(s.outstanding)} full={rs(s.outstanding)} note={`${pct(s.outstanding, s.billed)} of total challan, still open`} />
              <Tile alert={s.overdue > 0} label="Overdue" value={rsShort(s.overdue)} full={rs(s.overdue)} note="Unpaid and past the due date" />
              <Tile alert={s.defaulters > 0} label="Defaulters" value={count(s.defaulters)} note="Students with an overdue balance" />
            </Ledger>
          )
        }}
      </Loadable>

      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Fee collected by month" className="xl:col-span-2" state={cols} noun="collections"
          subtitle={cols.data?.length ? `${rs(collected)} received through fee and bank receipts` : 'Money received through fee and bank receipts'}>
          {(rows) => {
            const months = rollup(rows, (r) => monthKey(r.receiptDate), ['amount']).sort((a, b) => a.key.localeCompare(b.key))
            return <TrendArea name="Collected" format={rs} axisFormat={rsShort} height={230}
              data={months.map((m) => ({ label: monthLabel(m.key), value: m.amount }))} />
          }}
        </Block>

        <Block title="Total challan and paid by degree" subtitle="Challan amount raised, and how much of it has been paid" state={recv} noun="receivables">
          {(rows) => (
            <BarList format={rsShort} max={7} series={[{ label: 'Total challan', color: C.s1 }, { label: 'Paid', color: C.s3 }]}
              rows={rollup(rows, degreeKey, ['billed', 'received']).map((g) => ({
                key: g.key, label: degreeName(g.first), values: [g.billed, g.received], note: `${pct(g.received, g.billed)} paid`,
              }))} />
          )}
        </Block>

        <Block title="Students by degree" subtitle={latest ? `Registered in ${latest.name}` : 'Registered students'} state={regs} noun="registrations">
          {() => (
            <BarList format={count} max={10} series={[{ label: 'Students', color: C.s1 }]}
              rows={rollup(latest?.rows ?? [], degreeKey, ['students']).map((g) => ({ key: g.key, label: degreeName(g.first), values: [g.students] }))} />
          )}
        </Block>
      </div>
    </div>
  )
}

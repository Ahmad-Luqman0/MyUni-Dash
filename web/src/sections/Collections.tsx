import { useState } from 'react'
import type { CollectionRow } from '../api'
import { rollup, sum } from '../useData'
import { count, dateLabel, dayLabel, monthLabel, pct, rs, rsShort } from '../format'
import { BarList, Columns, Ledger, SplitBar, Tile, TrendArea } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable, Segmented } from '../components/ui'
import { DegreeCell, SectionSkeleton } from './shared'
import { CHALLAN_COLOR, challanLabel, degreeKey, degreeName, monthKey, usePortion, type SectionProps } from './helpers'

const SOURCES = [{ key: 'Bank receipt', label: 'Bank receipt', color: C.s1 }, { key: 'Fee receipt', label: 'Fee receipt', color: C.s3 }]

const columns: Column<CollectionRow>[] = [
  { key: 'date', header: 'Date', cell: (r) => dateLabel(r.receiptDate), sort: (r) => r.receiptDate, nowrap: true },
  { key: 'source', header: 'Source', cell: (r) => r.source, sort: (r) => r.source, nowrap: true },
  { key: 'degree', header: 'Degree', cell: (r) => <DegreeCell row={r} />, sort: degreeName },
  { key: 'type', header: 'Challan type', cell: (r) => challanLabel(r.challanType), sort: (r) => challanLabel(r.challanType), nowrap: true },
  { key: 'receipts', header: 'Receipts', cell: (r) => count(r.receipts), sort: (r) => r.receipts, align: 'right' },
  { key: 'amount', header: 'Amount', cell: (r) => rs(r.amount), sort: (r) => r.amount, align: 'right' },
]

export function Collections({ q, reload }: SectionProps) {
  const state = usePortion<CollectionRow>('collections', q, reload)
  const [grain, setGrain] = useState<'month' | 'day'>('month')
  return (
    <Loadable state={state} noun="collections" skeleton={<SectionSkeleton />}>
      {(rows) => {
        const total = sum(rows, (r) => r.amount), receipts = sum(rows, (r) => r.receipts)
        const bank = sum(rows.filter((r) => r.source === 'Bank receipt'), (r) => r.amount)
        const months = new Map<string, Record<string, number>>()
        for (const r of rows) {
          const m = months.get(monthKey(r.receiptDate)) ?? {}
          m[r.source] = (m[r.source] ?? 0) + r.amount
          months.set(monthKey(r.receiptDate), m)
        }
        const days = rollup(rows, (r) => r.receiptDate.slice(0, 10), ['amount']).sort((a, b) => a.key.localeCompare(b.key))
        const best = days.reduce((a, d) => (d.amount > a.amount ? d : a), days[0])
        const sources = rollup(rows, (r) => r.source, ['amount', 'receipts'])
        const types = rollup(rows, (r) => r.challanType ?? '', ['amount', 'receipts'])
        const otherSources = sources.filter((s) => !SOURCES.some((k) => k.key === s.key))
        return (
          <div className="space-y-4">
            <Ledger cols={4}>
              <Tile label="Collected" value={rsShort(total)} full={rs(total)} note={`${dayLabel(days[0].key)} to ${dateLabel(days[days.length - 1].key)}`} />
              <Tile label="Receipts" value={count(receipts)} note={`${rs(receipts > 0 ? total / receipts : 0)} on average`} />
              <Tile label="Through the bank" value={pct(bank, total)} note={`${rsShort(bank)} came in as bank receipts`} />
              <Tile label="Busiest day" value={rsShort(best.amount)} full={rs(best.amount)} note={dateLabel(best.key)} />
            </Ledger>

            <Card title="Amount collected over time" subtitle={grain === 'month' ? 'By month, split by where the money came in' : 'By day, all sources together'}
              action={<Segmented label="Show collections by" value={grain} onChange={setGrain} options={[['month', 'Monthly'], ['day', 'Daily']]} />}>
              {grain === 'month'
                ? <Columns stacked name="Amount collected by month and source" format={rs} axisFormat={rsShort} series={SOURCES}
                    data={[...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: monthLabel(k), ...v }))} />
                : <TrendArea name="Collected" format={rs} axisFormat={rsShort} height={284}
                    data={days.map((d) => ({ label: dayLabel(d.key), title: dateLabel(d.key), value: d.amount }))} />}
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid content-start gap-4">
                <Card title="By source" subtitle="Fee receipts are taken at the counter; bank receipts arrive through the bank">
                  <SplitBar format={rs} parts={[
                    ...SOURCES.map((s) => ({ label: s.label, color: s.color, value: sources.find((x) => x.key === s.key)?.amount ?? 0 })),
                    ...(otherSources.length ? [{ label: 'Other sources', color: C.s4, value: sum(otherSources, (s) => s.amount) }] : []),
                  ]} />
                </Card>
                <Card title="By challan type" subtitle="What the money was paid against">
                  <SplitBar format={rs} parts={[...types].sort((a, b) => b.amount - a.amount).map((t) => ({
                    label: challanLabel(t.key || null), value: t.amount, color: CHALLAN_COLOR[t.key] ?? C.s5, note: `${count(t.receipts)} receipts`,
                  }))} />
                </Card>
              </div>
              <Card title="By degree" subtitle="Amount collected from students of each degree">
                <BarList format={rs} max={12} series={[{ label: 'Collected', color: C.s1 }]}
                  rows={rollup(rows, degreeKey, ['amount']).map((g) => ({ key: g.key, label: degreeName(g.first), values: [g.amount] }))} />
              </Card>
            </div>

            <Card title="Receipts" subtitle="One row per day, source, degree and challan type">
              <DataTable caption="Receipts" columns={columns} rows={rows} rowKey={(_, i) => String(i)} initialSort={{ key: 'date', dir: 'desc' }}
                search={(r) => `${r.source} ${r.degree} ${r.degreeCode} ${challanLabel(r.challanType)} ${dateLabel(r.receiptDate)}`} searchLabel="Search by degree, source or date" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

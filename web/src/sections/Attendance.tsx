import type { AttendanceRow } from '../api'
import { rollup } from '../useData'
import { count, countShort, monthLabel, nice, pct, rs, rsShort } from '../format'
import { BarList, Columns, Ledger, SplitBar, Tile, TrendArea } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable } from '../components/ui'
import { Quiet, SectionSkeleton } from './shared'
import { monthKey, usePortion, type SectionProps } from './helpers'

const FIELDS = ['employees', 'daysWorked', 'absences', 'leaves', 'lateArrivals', 'earlyDepartures', 'lateMinutes', 'overTimeAmount', 'deductionAmount'] satisfies (keyof AttendanceRow)[]
type Line = ReturnType<typeof rollup<AttendanceRow, (typeof FIELDS)[number]>>[number]
type Days = Pick<AttendanceRow, 'daysWorked' | 'absences' | 'leaves'>

/** Working days on the sheet: worked, absent or on leave. */
const due = (r: Days) => r.daysWorked + r.absences + r.leaves
/** Share of working days actually worked, 0 to 100; null when nothing was recorded. */
const rate = (r: Days) => (due(r) > 0 ? (r.daysWorked / due(r)) * 100 : null)
const percent = (n: number) => `${n.toFixed(1)}%`
const days = (n: number) => `${count(n)} ${Math.round(n) === 1 ? 'day' : 'days'}`

// Absent is the bad state and keeps red; leave is approved time off.
const LOST = [{ key: 'absences', label: 'Absent', color: C.bad }, { key: 'leaves', label: 'On leave', color: C.s2 }]

const columns: Column<Line>[] = [
  { key: 'month', header: 'Month', cell: (r) => monthLabel(r.first.month), sort: (r) => r.first.month, nowrap: true },
  { key: 'department', header: 'Department', cell: (r) => <span className="block min-w-40">{nice(r.first.department)}</span>, sort: (r) => nice(r.first.department) },
  { key: 'employees', header: 'Employees', cell: (r) => count(r.employees), sort: (r) => r.employees, align: 'right' },
  { key: 'worked', header: 'Days worked', cell: (r) => count(r.daysWorked), sort: (r) => r.daysWorked, align: 'right' },
  { key: 'absences', header: 'Absent days', cell: (r) => count(r.absences), sort: (r) => r.absences, align: 'right' },
  { key: 'leaves', header: 'Leave days', cell: (r) => count(r.leaves), sort: (r) => r.leaves, align: 'right' },
  { key: 'rate', header: 'Attendance', cell: (r) => pct(r.daysWorked, due(r)), sort: (r) => rate(r) ?? -1, align: 'right' },
  { key: 'late', header: 'Late arrivals', cell: (r) => count(r.lateArrivals), sort: (r) => r.lateArrivals, align: 'right' },
  { key: 'overtime', header: 'Overtime paid', cell: (r) => rs(r.overTimeAmount), sort: (r) => r.overTimeAmount, align: 'right' },
]

export function Attendance({ q, reload }: SectionProps) {
  const state = usePortion<AttendanceRow>('attendance', q, reload)
  return (
    <Loadable state={state} noun="attendance" skeleton={<SectionSkeleton tiles={6} cols={3} />}>
      {(rows) => {
        const t = rollup(rows, () => 'all', FIELDS)[0]
        const months = rollup(rows, (r) => monthKey(r.month), FIELDS).sort((a, b) => a.key.localeCompare(b.key))
        const span = months.length > 1 ? `${monthLabel(months[0].key)} to ${monthLabel(months[months.length - 1].key)}` : monthLabel(months[0].key)
        const depts = rollup(rows, (r) => r.department ?? '', FIELDS)
        const rated = months.filter((m) => due(m) > 0)
        const late = depts.filter((d) => d.lateArrivals > 0)
        const lines = rollup(rows, (r) => `${monthKey(r.month)}|${r.department ?? ''}`, FIELDS)
        return (
          <div className="space-y-4">
            <Ledger cols={3}>
              <Tile label="Attendance rate" value={pct(t.daysWorked, due(t))} note={`${count(t.daysWorked)} of ${count(due(t))} working days worked`} />
              <Tile alert={t.absences > 0} label="Absent days" value={count(t.absences)} note={`${pct(t.absences, due(t))} of working days`} />
              <Tile label="Leave days" value={count(t.leaves)} note={`${pct(t.leaves, due(t))} of working days`} />
              <Tile label="Late arrivals" value={count(t.lateArrivals)}
                note={t.lateArrivals > 0 ? `${count(t.lateMinutes / t.lateArrivals)} minutes late on average` : 'None recorded'} />
              <Tile label="Left early" value={count(t.earlyDepartures)} note="Occasions an employee left before time" />
              <Tile label="Overtime paid" value={rsShort(t.overTimeAmount)} full={rs(t.overTimeAmount)} note={`${rsShort(t.deductionAmount)} deducted for absence`} />
            </Ledger>

            <Card title="Attendance rate by month" subtitle="Days worked as a share of working days (worked, absent and on leave)">
              {rated.length > 0
                ? <TrendArea name="Attendance rate" format={percent} axisFormat={(n) => `${n}%`} height={260}
                    data={rated.map((m) => ({ label: monthLabel(m.key), value: rate(m)! }))} />
                : <Quiet>No working days are recorded for these filters, so there is no rate to show.</Quiet>}
            </Card>

            <Card title="Days lost by month" subtitle="Working days not worked, split into absence and leave">
              <Columns stacked name="Absent and leave days by month" format={days} axisFormat={countShort} series={LOST}
                data={months.map((m) => ({ label: monthLabel(m.key), absences: m.absences, leaves: m.leaves }))} />
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid content-start gap-4">
                <Card title="Where the working days went" subtitle={`Every working day on the attendance sheets, ${span}`}>
                  {due(t) > 0
                    ? <SplitBar format={days} parts={[
                        { label: 'Worked', color: C.s3, value: t.daysWorked },
                        { label: 'On leave', color: C.s2, value: t.leaves },
                        { label: 'Absent', color: C.bad, value: t.absences },
                      ]} />
                    : <Quiet>No working days are recorded for these filters.</Quiet>}
                </Card>
                <Card title="Late arrivals by department" subtitle={`Occasions an employee came in late, ${span}`}>
                  {late.length > 0
                    ? <BarList format={count} max={6} otherLabel="Other departments" series={[{ label: 'Late arrivals', color: C.s2 }]}
                        rows={late.map((d) => ({ key: d.key, label: nice(d.first.department), values: [d.lateArrivals], note: `${count(d.lateMinutes / d.lateArrivals)} minutes late on average` }))} />
                    : <Quiet>No late arrivals are recorded for these filters.</Quiet>}
                </Card>
              </div>
              <Card title="Absence by department" subtitle={`Absent days as a share of each department's working days, ${span}`}>
                <BarList format={percent} max={12} series={[{ label: 'Absence rate', color: C.bad }]}
                  rows={depts.filter((d) => due(d) > 0).map((d) => ({
                    key: d.key, label: nice(d.first.department), values: [(d.absences / due(d)) * 100], note: `${days(d.absences)} absent of ${count(due(d))}`,
                  }))} />
              </Card>
            </div>

            <Card title="Attendance" subtitle="One row per month and department, all campuses in view together">
              <DataTable caption="Attendance" columns={columns} rows={lines} rowKey={(r) => r.key} initialSort={{ key: 'month', dir: 'desc' }}
                search={(r) => `${monthLabel(r.first.month)} ${nice(r.first.department)}`} searchLabel="Search by department or month" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

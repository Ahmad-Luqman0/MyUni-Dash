import type { AdmissionRow } from '../api'
import { rollup, sum } from '../useData'
import { count, countShort, pct, rs, rsShort } from '../format'
import { BarList, Columns, Ledger, Tile } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable } from '../components/ui'
import { DegreeCell, Quiet, SectionSkeleton } from './shared'
import { degreeKey, degreeName, usePortion, type SectionProps } from './helpers'

const columns: Column<AdmissionRow>[] = [
  { key: 'semester', header: 'Semester', cell: (r) => r.semester ?? '–', sort: (r) => r.semesterStart ?? '', nowrap: true },
  { key: 'degree', header: 'Degree', cell: (r) => <DegreeCell row={r} />, sort: degreeName },
  { key: 'shift', header: 'Shift', cell: (r) => r.programType ?? '–', sort: (r) => r.programType ?? '' },
  { key: 'announcements', header: 'Announcements', cell: (r) => count(r.announcements), sort: (r) => r.announcements, align: 'right' },
  { key: 'seats', header: 'Seats', cell: (r) => count(r.seats), sort: (r) => r.seats, align: 'right' },
  { key: 'admitted', header: 'Admitted', cell: (r) => count(r.admitted), sort: (r) => r.admitted, align: 'right' },
  { key: 'fill', header: 'Fill rate', cell: (r) => pct(r.admitted, r.seats), sort: (r) => (r.seats > 0 ? r.admitted / r.seats : -1), align: 'right' },
  { key: 'fee', header: 'Announced fee', cell: (r) => rs(r.feeAmount), sort: (r) => r.feeAmount, align: 'right' },
]

export function Admissions({ q, reload }: SectionProps) {
  const state = usePortion<AdmissionRow>('admissions', q, reload)
  return (
    <Loadable state={state} noun="admissions" skeleton={<SectionSkeleton />}>
      {(rows) => {
        const seats = sum(rows, (r) => r.seats), admitted = sum(rows, (r) => r.admitted)
        const avgFee = seats > 0 ? sum(rows, (r) => r.feeAmount * r.seats) / seats : 0
        const degrees = rollup(rows, degreeKey, ['seats', 'admitted'])
        const semesters = rollup(rows, (r) => r.semesterId ?? '', ['seats', 'admitted']).sort((a, b) => (a.first.semesterStart ?? '').localeCompare(b.first.semesterStart ?? ''))
        // The fee announced for each degree at its most recent intake in view.
        const fees = new Map<string, AdmissionRow>()
        for (const r of rows) {
          const k = degreeKey(r), had = fees.get(k)
          const newer = !had || (r.semesterStart ?? '') > (had.semesterStart ?? '')
          if (newer || (r.semesterStart === had.semesterStart && r.feeAmount > had.feeAmount)) fees.set(k, r)
        }
        const full = degrees.filter((d) => d.seats > 0 && d.admitted >= d.seats).length
        return (
          <div className="space-y-4">
            <Ledger cols={4}>
              <Tile label="Seats announced" value={count(seats)} note={`${count(sum(rows, (r) => r.announcements))} admission announcements`} />
              <Tile label="Students admitted" value={count(admitted)} note={`${count(Math.max(0, seats - admitted))} seats still open`} />
              <Tile label="Fill rate" value={pct(admitted, seats)} note={`${full} of ${degrees.length} programs are full`} />
              <Tile label="Average announced fee" value={rsShort(avgFee)} full={rs(avgFee)} note="Per student, weighted by seats" />
            </Ledger>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Seats and admissions by degree" subtitle="Seats announced against students admitted">
                <BarList format={count} max={12} series={[{ label: 'Seats', color: C.s3 }, { label: 'Admitted', color: C.s1 }]}
                  rows={degrees.map((g) => ({ key: g.key, label: degreeName(g.first), values: [g.seats, g.admitted], note: `${pct(g.admitted, g.seats)} filled` }))} />
              </Card>
              <div className="grid content-start gap-4">
                <Card title="Seats and admissions by semester" subtitle="Each admission intake">
                  {semesters.length > 1
                    ? <Columns name="Seats and admissions by semester" format={count} axisFormat={countShort}
                        series={[{ key: 'seats', label: 'Seats', color: C.s3 }, { key: 'admitted', label: 'Admitted', color: C.s1 }]}
                        data={semesters.map((s) => ({ label: s.first.semester ?? '–', seats: s.seats, admitted: s.admitted }))} />
                    : <Quiet>Only {semesters[0]?.first.semester ?? 'one semester'} is in view. Choose “All semesters” on the strip above to compare intakes.</Quiet>}
                </Card>
                <Card title="Announced fee by degree" subtitle="Per student, latest intake in view">
                  <BarList format={rs} max={12} series={[{ label: 'Announced fee', color: C.s1 }]}
                    rows={[...fees.entries()].map(([k, r]) => ({ key: k, label: degreeName(r), values: [r.feeAmount] }))} />
                </Card>
              </div>
            </div>

            <Card title="Admissions" subtitle="One row per semester, degree and shift">
              <DataTable caption="Admissions" columns={columns} rows={rows} rowKey={(_, i) => String(i)} initialSort={{ key: 'semester', dir: 'desc' }}
                search={(r) => `${r.semester} ${r.degree} ${r.degreeCode} ${r.department} ${r.programType}`} searchLabel="Search by degree or semester" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

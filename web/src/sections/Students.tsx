import { useState } from 'react'
import type { RegistrationRow } from '../api'
import { rollup, sum } from '../useData'
import { count, countShort, nice, pct } from '../format'
import { BarList, Columns, Ledger, SplitBar, Tile } from '../components/charts'
import { C } from '../palette'
import { DataTable, type Column } from '../components/DataTable'
import { Card, Loadable, Segmented } from '../components/ui'
import { DegreeCell, Quiet, SectionSkeleton } from './shared'
import { SHIFT_COLOR, degreeKey, degreeName, latestSemester, usePortion, type SectionProps } from './helpers'

const columns: Column<RegistrationRow>[] = [
  { key: 'semester', header: 'Semester', cell: (r) => r.semester ?? '–', sort: (r) => r.semesterStart ?? '', nowrap: true },
  { key: 'degree', header: 'Degree', cell: (r) => <DegreeCell row={r} />, sort: degreeName },
  { key: 'faculty', header: 'Faculty', cell: (r) => nice(r.faculty), sort: (r) => r.faculty ?? '' },
  { key: 'no', header: 'Semester no.', cell: (r) => r.semesterNo ?? '–', sort: (r) => r.semesterNo ?? 0, align: 'right' },
  { key: 'shift', header: 'Shift', cell: (r) => r.programType ?? '–', sort: (r) => r.programType ?? '' },
  { key: 'students', header: 'Students', cell: (r) => count(r.students), sort: (r) => r.students, align: 'right' },
]

export function Students({ q, reload }: SectionProps) {
  const state = usePortion<RegistrationRow>('registrations', q, reload)
  const [by, setBy] = useState<'faculty' | 'department'>('faculty')
  return (
    <Loadable state={state} noun="registrations" skeleton={<SectionSkeleton />}>
      {(rows) => {
        const latest = latestSemester(rows)!
        const now = latest.rows
        const total = sum(now, (r) => r.students)
        const semesters = rollup(rows, (r) => r.semesterId ?? '', ['students']).sort((a, b) => (a.first.semesterStart ?? '').localeCompare(b.first.semesterStart ?? ''))
        const degrees = rollup(now, degreeKey, ['students']).sort((a, b) => b.students - a.students)
        const shifts = rollup(now, (r) => r.programType ?? 'Not specified', ['students'])
        const numbers = rollup(now, (r) => String(r.semesterNo ?? 0), ['students']).sort((a, b) => Number(a.key) - Number(b.key))
        const afterHours = sum(now.filter((r) => r.programType !== 'Morning'), (r) => r.students)
        const groups = rollup(now, (r) => (by === 'faculty' ? r.faculty : r.department) ?? 'Not specified', ['students'])
        return (
          <div className="space-y-4">
            <Ledger cols={4}>
              <Tile label={`Registered in ${latest.name}`} value={count(total)} note={semesters.length > 1 ? `Latest of ${semesters.length} semesters in view` : 'The semester in view'} />
              <Tile label="Programs with students" value={count(degrees.length)} note="Degree programs" />
              <Tile label="Largest program" value={count(degrees[0]?.students ?? 0)} note={degrees[0] ? degreeName(degrees[0].first) : undefined} />
              <Tile label="Evening and weekend" value={pct(afterHours, total)} note={`${count(afterHours)} students outside the morning shift`} />
            </Ledger>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Students by semester" subtitle="Registered students in each semester">
                {semesters.length > 1
                  ? <Columns name="Students by semester" format={count} axisFormat={countShort} series={[{ key: 'students', label: 'Students', color: C.s1 }]}
                      data={semesters.map((s) => ({ label: s.first.semester ?? '–', students: s.students }))} />
                  : <Quiet>Only {latest.name} is in view. Choose “All semesters” on the strip above to compare semesters.</Quiet>}
              </Card>
              <Card title="Students by semester number" subtitle={`How far along students are, ${latest.name}`}>
                <Columns name="Students by semester number" format={count} axisFormat={countShort} series={[{ key: 'students', label: 'Students', color: C.s1 }]}
                  data={numbers.map((n) => ({ label: n.key === '0' ? 'Not set' : n.key, title: n.key === '0' ? 'Semester number not set' : `Semester ${n.key}`, students: n.students }))} />
              </Card>
              <Card title="Students by degree" subtitle={`Registered in ${latest.name}`}>
                <BarList format={count} max={12} series={[{ label: 'Students', color: C.s1 }]}
                  rows={degrees.map((g) => ({ key: g.key, label: degreeName(g.first), values: [g.students] }))} />
              </Card>
              <div className="grid content-start gap-4">
                <Card title="Students by shift" subtitle={`Registered in ${latest.name}`}>
                  <SplitBar format={count} parts={['Morning', 'Evening', 'Weekend', 'Not specified'].flatMap((name) => {
                    const g = shifts.find((s) => s.key === name)
                    return g ? [{ label: name, value: g.students, color: SHIFT_COLOR[name] ?? C.s4 }] : []
                  })} />
                </Card>
                <Card title={by === 'faculty' ? 'Students by faculty' : 'Students by department'} subtitle={`Registered in ${latest.name}`}
                  action={<Segmented label="Group students by" value={by} onChange={setBy} options={[['faculty', 'Faculty'], ['department', 'Department']]} />}>
                  <BarList format={count} series={[{ label: 'Students', color: C.s1 }]}
                    rows={groups.map((g) => ({ key: g.key, label: nice(g.key), values: [g.students] }))} />
                </Card>
              </div>
            </div>

            <Card title="Registrations" subtitle="One row per semester, degree, semester number and shift">
              <DataTable caption="Registrations" columns={columns} rows={rows} rowKey={(_, i) => String(i)} initialSort={{ key: 'semester', dir: 'desc' }}
                search={(r) => `${r.semester} ${r.degree} ${r.degreeCode} ${r.department} ${r.faculty} ${r.programType}`} searchLabel="Search by degree, faculty or semester" />
            </Card>
          </div>
        )
      }}
    </Loadable>
  )
}

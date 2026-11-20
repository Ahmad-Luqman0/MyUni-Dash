import { RotateCw } from 'lucide-react'
import type { Branch, Company, Degree, Faculty } from '../api'
import { isoDate, nice } from '../format'
import { Button, DateInput, Field, Select } from './ui'

export interface Selection {
  companyId: number | null
  branchId: number | null
  facultyId: string | null
  departmentId: number | null
  /** The employee department chosen on the HR pages: a different list from the academic departments. */
  hrDepartmentId: number | null
  degreeId: string | null
  semesterId: string | null
  startDate: string
  endDate: string
}

type PeriodKey = 'all' | 'month' | 'quarter' | 'year' | 'custom'
const PERIODS: [PeriodKey, string][] = [['all', 'All time'], ['month', 'This month'], ['quarter', 'Last 3 months'], ['year', 'This year']]

function periodRange(key: PeriodKey): [string, string] {
  const now = new Date()
  const today = isoDate(now)
  if (key === 'month') return [isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), today]
  if (key === 'quarter') return [isoDate(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate() + 1)), today]
  if (key === 'year') return [isoDate(new Date(now.getFullYear(), 0, 1)), today]
  return ['', '']
}

function currentPeriod(start: string, end: string): PeriodKey {
  for (const [key] of PERIODS) {
    const [s, e] = periodRange(key)
    if (s === start && e === end) return key
  }
  return 'custom'
}

/**
 * The filters every section shares. Semester is chosen on the strip above.
 * On the HR pages (`hr`) faculty and degree do not apply and are left out, and `lists.departments` holds the employee
 * departments, whose choice is kept apart from the academic one.
 */
export function FilterBar({ sel, change, lists, busy, onRefresh, hr = false }: {
  sel: Selection; change: (patch: Partial<Selection>) => void; busy: boolean; onRefresh: () => void; hr?: boolean
  lists: {
    companies: Company[] | null; branches: Branch[] | null; faculties: Faculty[] | null
    departments: { id: number; description: string }[] | null; degrees: Degree[] | null
  }
}) {
  const period = currentPeriod(sel.startDate, sel.endDate)
  const wide = hr
    ? 'min-[104rem]:grid-cols-[1.15fr_1fr_1fr_0.95fr_1.05fr_1.05fr_auto]'
    : 'min-[104rem]:grid-cols-[1.15fr_1fr_1fr_1fr_1.15fr_0.95fr_1.05fr_1.05fr_auto]'
  return (
    <form aria-label="Filters" onSubmit={(e) => e.preventDefault()}
      className={`grid grid-cols-2 items-end gap-x-3 gap-y-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-3 sm:px-5 lg:grid-cols-4 xl:grid-cols-5 ${wide}`}>
      <Field label="Company" className="col-span-2 sm:col-span-1">
        <Select value={String(sel.companyId ?? '')} disabled={!lists.companies}
          onChange={(v) => change({ companyId: Number(v), branchId: null, facultyId: null, departmentId: null, hrDepartmentId: null, degreeId: null, semesterId: null })}>
          {!lists.companies && <option value="">Loading</option>}
          {lists.companies?.map((c) => <option key={c.id} value={c.id}>{nice(c.companyName)}</option>)}
        </Select>
      </Field>
      <Field label="Campus">
        <Select value={String(sel.branchId ?? '')} disabled={!lists.branches} onChange={(v) => change({ branchId: Number(v) || null })}>
          <option value="">All campuses</option>
          {lists.branches?.map((b) => <option key={b.id} value={b.id}>{nice(b.description)}{b.city ? `, ${nice(b.city)}` : ''}</option>)}
        </Select>
      </Field>
      {!hr && (
        <Field label="Faculty">
          <Select value={sel.facultyId ?? ''} disabled={!lists.faculties} onChange={(v) => change({ facultyId: v || null, departmentId: null, degreeId: null })}>
            <option value="">All faculties</option>
            {lists.faculties?.map((f) => <option key={f.id} value={f.id}>{nice(f.description)}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Department">
        <Select value={String((hr ? sel.hrDepartmentId : sel.departmentId) ?? '')} disabled={!lists.departments}
          onChange={(v) => change(hr ? { hrDepartmentId: Number(v) || null } : { departmentId: Number(v) || null, degreeId: null })}>
          <option value="">All departments</option>
          {lists.departments?.map((d) => <option key={d.id} value={d.id}>{nice(d.description)}</option>)}
        </Select>
      </Field>
      {!hr && (
        <Field label="Degree">
          <Select value={sel.degreeId ?? ''} disabled={!lists.degrees} onChange={(v) => change({ degreeId: v || null })}>
            <option value="">All degrees</option>
            {lists.degrees?.map((d) => <option key={d.id} value={d.id}>{nice(d.degreeName)}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Period" className="col-span-2 sm:col-span-1">
        <Select value={period} onChange={(v) => { if (v !== 'custom') { const [s, e] = periodRange(v as PeriodKey); change({ startDate: s, endDate: e }) } }}>
          {PERIODS.map(([k, text]) => <option key={k} value={k}>{text}</option>)}
          {period === 'custom' && <option value="custom">Custom dates</option>}
        </Select>
      </Field>
      <Field label="From">
        <DateInput value={sel.startDate} max={sel.endDate || undefined} onChange={(v) => change({ startDate: v })} />
      </Field>
      <Field label="To">
        <DateInput value={sel.endDate} min={sel.startDate || undefined} onChange={(v) => change({ endDate: v })} />
      </Field>
      <div className="col-span-2 sm:col-span-1 [&>button]:w-full">
        <Button onClick={onRefresh} disabled={busy}>
          <RotateCw aria-hidden className={`size-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />Refresh
        </Button>
      </div>
    </form>
  )
}

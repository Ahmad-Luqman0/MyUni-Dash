import { urls, type Portion, type Query } from '../api'
import { useData, type Loaded } from '../useData'
import { nice } from '../format'
import { C } from '../palette'

/** semester: the code of the semester chosen on the strip (e.g. SUMMER-2026); null when all semesters are in view. */
export interface SectionProps { q: Query | null; reload: number; semester?: string | null }

/** One portion of the dashboard for the current filters. */
export function usePortion<T>(portion: Portion, q: Query | null, reload: number): Loaded<T[]> {
  return useData<T[]>(q ? urls.portion(portion, q) : null, reload)
}

export const degreeKey = (r: { degreeId?: string | null; degreeCode: string | null; degree: string | null }) => r.degreeId ?? r.degreeCode ?? r.degree ?? ''
export const degreeName = (r: { degreeCode: string | null; degree: string | null }) => nice(r.degree ?? r.degreeCode)
export const monthKey = (iso: string) => `${iso.slice(0, 7)}-01`

/** The most recent semester among the rows. Head counts are per semester, so "by degree" views use one semester, not the sum of all. */
export function latestSemester<T extends { semesterId: string | null; semester: string | null; semesterStart: string | null }>(rows: T[]) {
  let best: T | null = null
  for (const r of rows) if (!best || (r.semesterStart ?? '') > (best.semesterStart ?? '')) best = r
  return best ? { id: best.semesterId, name: best.semester ?? 'the latest semester', rows: rows.filter((r) => r.semesterId === best.semesterId) } : null
}

export const SHIFT_COLOR: Record<string, string> = { Morning: C.s1, Evening: C.s2, Weekend: C.s3 }
export const CHALLAN_COLOR: Record<string, string> = {
  'Existing/Old Student (Challan)': C.s1, 'New Admission (Challan)': C.s2, 'Installments (Challan)': C.s3, 'Others (Challan)': C.s4,
}
const CHALLAN_LABEL: Record<string, string> = {
  'Existing/Old Student (Challan)': 'Existing students', 'New Admission (Challan)': 'New admissions', 'Installments (Challan)': 'Installments', 'Others (Challan)': 'Other challans',
}
export const challanLabel = (t: string | null) => (t ? CHALLAN_LABEL[t] ?? t.replace(/\s*\(Challan\)\s*$/i, '') : 'Not specified')

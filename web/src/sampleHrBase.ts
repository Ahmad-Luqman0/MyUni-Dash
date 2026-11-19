/** Sample mode only: the staff departments and campuses both HR sample files share, so their figures line up. */
export const HR_DEPARTMENTS = [
  { id: 101, description: 'Computer Science', employees: 64 },
  { id: 102, description: 'Business Administration', employees: 52 },
  { id: 103, description: 'Pharmacy', employees: 47 },
  { id: 104, description: 'Law', employees: 23 },
  { id: 105, description: 'Psychology', employees: 21 },
  { id: 106, description: 'Admissions and Registrar', employees: 34 },
  { id: 107, description: 'Finance and Accounts', employees: 26 },
  { id: 108, description: 'IT Services', employees: 18 },
  { id: 109, description: 'Administration and Security', employees: 88 },
  { id: 110, description: 'Library', employees: 12 },
] as const
/** Share of each department's staff at each campus, by the sample campus ids used in sample.ts (1, 2, 3). */
export const HR_BRANCH_SHARE: Record<number, number> = { 1: 0.55, 2: 0.3, 3: 0.15 }
/** The sample's "today", as in sample.ts. */
export const HR_TODAY = '2026-11-19'

/**
 * Sample mode only: the made-up university's staff. About 385 current employees (the head counts in sampleHrBase) plus
 * some who have left, each with a salary structure that fits the job. Built once with a seeded generator, so the
 * figures are the same on every reload and for every filter.
 */
import type { EmployeeDepartment, EmployeeRow, SalaryStructureRow } from './api'
import { HR_BRANCH_SHARE, HR_DEPARTMENTS, HR_TODAY } from './sampleHrBase'

// ---- seeded random -------------------------------------------------------------------------------------------------
let seed = 385_2026
function rnd() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (a: number, b: number) => a + (b - a) * rnd()
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]
function weighted<T>(xs: readonly (readonly [T, number])[]): T {
  let r = rnd() * xs.reduce((a, x) => a + x[1], 0)
  for (const [v, w] of xs) { r -= w; if (r <= 0) return v }
  return xs[xs.length - 1][0]
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`
const day = (s: string) => new Date(`${s}T00:00:00`)
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const round500 = (n: number) => Math.round(n / 500) * 500

const TODAY = day(HR_TODAY)
/** Campus names as in sample.ts, by campus id. */
const BRANCH_NAME: Record<number, string> = { 1: 'MAIN CAMPUS', 2: 'CITY CAMPUS', 3: 'NORTH CAMPUS' }

// ---- jobs ----------------------------------------------------------------------------------------------------------
type Kind = 'FACULTY' | 'ADMINISTRATIVE STAFF' | 'SUPPORT STAFF'
/** [designation, kind, lowest basic, highest basic] in PKR a month. */
type Job = readonly [string, Kind, number, number]
const F = 'FACULTY', A = 'ADMINISTRATIVE STAFF', S = 'SUPPORT STAFF'
const JOB: Record<string, Job> = {
  prof: ['PROFESSOR', F, 260000, 380000], assoc: ['ASSOCIATE PROFESSOR', F, 180000, 250000], asst: ['ASSISTANT PROFESSOR', F, 120000, 175000],
  lect: ['LECTURER', F, 70000, 110000], labEng: ['LAB ENGINEER', F, 55000, 80000], labTech: ['LAB TECHNICIAN', S, 35000, 50000],
  coord: ['DEPARTMENT COORDINATOR', A, 45000, 65000], assistant: ['OFFICE ASSISTANT', S, 28000, 40000],
  registrar: ['REGISTRAR', A, 220000, 280000], depReg: ['DEPUTY REGISTRAR', A, 130000, 170000], admOff: ['ADMISSION OFFICER', A, 55000, 85000],
  counsellor: ['ADMISSION COUNSELLOR', A, 40000, 60000], exam: ['EXAMINATION OFFICER', A, 60000, 90000], dataEntry: ['DATA ENTRY OPERATOR', S, 30000, 42000],
  dirFin: ['DIRECTOR FINANCE', A, 250000, 320000], accOff: ['ACCOUNTS OFFICER', A, 80000, 120000], accountant: ['ACCOUNTANT', A, 60000, 95000],
  audit: ['AUDIT OFFICER', A, 75000, 110000], cashier: ['CASHIER', A, 38000, 52000],
  itMgr: ['IT MANAGER', A, 160000, 220000], dev: ['SOFTWARE DEVELOPER', A, 90000, 150000], network: ['NETWORK ADMINISTRATOR', A, 80000, 120000],
  itSupport: ['IT SUPPORT OFFICER', A, 45000, 70000],
  adminOff: ['ADMIN OFFICER', A, 60000, 90000], supervisor: ['SECURITY SUPERVISOR', S, 40000, 55000], guard: ['SECURITY GUARD', S, 30000, 37000],
  driver: ['DRIVER', S, 32000, 40000], electrician: ['ELECTRICIAN', S, 34000, 45000], officeBoy: ['OFFICE BOY', S, 28000, 34000],
  gardener: ['GARDENER', S, 28000, 33000], sweeper: ['SWEEPER', S, 27000, 32000],
  librarian: ['LIBRARIAN', A, 90000, 130000], asstLib: ['ASSISTANT LIBRARIAN', A, 50000, 70000], libAsst: ['LIBRARY ASSISTANT', S, 32000, 42000],
}

/** The mix of jobs in a teaching department, and in each office. [job, share of the department]. */
const TEACHING: [string, number][] = [['prof', 8], ['assoc', 12], ['asst', 26], ['lect', 36], ['coord', 6], ['assistant', 12]]
const WITH_LABS: [string, number][] = [['prof', 7], ['assoc', 11], ['asst', 24], ['lect', 32], ['labEng', 9], ['labTech', 6], ['coord', 4], ['assistant', 7]]
const MIX: Record<number, [string, number][]> = {
  101: WITH_LABS, 102: TEACHING, 103: WITH_LABS, 104: TEACHING, 105: TEACHING,
  106: [['registrar', 3], ['depReg', 6], ['admOff', 24], ['counsellor', 24], ['exam', 15], ['dataEntry', 18], ['assistant', 10]],
  107: [['dirFin', 4], ['accOff', 16], ['accountant', 34], ['audit', 8], ['cashier', 24], ['assistant', 14]],
  108: [['itMgr', 6], ['dev', 28], ['network', 17], ['itSupport', 49]],
  109: [['adminOff', 6], ['supervisor', 5], ['guard', 38], ['driver', 10], ['electrician', 6], ['officeBoy', 13], ['gardener', 8], ['sweeper', 14]],
  110: [['librarian', 9], ['asstLib', 25], ['libAsst', 50], ['assistant', 16]],
}

/** `n` jobs in the department's mix: each job gets its share, the most common job absorbs the rounding. */
function jobsFor(dept: number, n: number): Job[] {
  const mix = MIX[dept], total = mix.reduce((a, m) => a + m[1], 0)
  const out: Job[] = []
  for (const [key, w] of mix) for (let i = 0; i < Math.max(1, Math.round((w / total) * n)); i++) out.push(JOB[key])
  const common = JOB[[...mix].sort((a, b) => b[1] - a[1])[0][0]]
  while (out.length < n) out.push(common)
  while (out.length > n) out.splice(out.lastIndexOf(common), 1)
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}

// ---- people --------------------------------------------------------------------------------------------------------
const MEN = ['MUHAMMAD', 'AHMAD', 'ALI', 'HASSAN', 'HUSSAIN', 'USMAN', 'BILAL', 'IMRAN', 'KAMRAN', 'FAISAL', 'ASIF', 'TARIQ', 'NAVEED', 'SHAHID', 'ZAHID',
  'ADNAN', 'SALMAN', 'WAQAS', 'FARHAN', 'JUNAID', 'HAMZA', 'UMAR', 'SAAD', 'RIZWAN', 'NADEEM', 'IRFAN', 'KASHIF', 'ARSLAN', 'ZEESHAN', 'YASIR', 'SAJID', 'AMIR']
const WOMEN = ['AYESHA', 'FATIMA', 'MARYAM', 'SANA', 'HINA', 'SADIA', 'NADIA', 'RABIA', 'AMNA', 'ZAINAB', 'SAIMA', 'UZMA', 'BUSHRA', 'MEHWISH', 'KIRAN',
  'SIDRA', 'IQRA', 'MAHNOOR', 'ANUM', 'SAMINA', 'FARAH', 'TAHIRA', 'NIDA', 'HAFSA']
const FAMILY = ['KHAN', 'AHMED', 'MALIK', 'BUTT', 'CHAUDHRY', 'SHEIKH', 'QURESHI', 'HUSSAIN', 'IQBAL', 'RAZA', 'SIDDIQUI', 'AKHTAR', 'MIRZA', 'ASLAM', 'JAVED',
  'MEHMOOD', 'RASHID', 'ANWAR', 'SALEEM', 'AWAN', 'BHATTI', 'GILL', 'RANA', 'NIAZI', 'ABBASI', 'FAROOQ', 'ASHRAF', 'HAIDER', 'ZAMAN', 'YOUSAF']

interface Person { row: EmployeeRow; branchId: number; departmentId: number; job: Job }

/** A hiring date in the last 15 years. The university has grown, so later years took on more people. */
function hiredOn(): Date {
  const year = weighted([[2011, 3], [2012, 3], [2013, 4], [2014, 4], [2015, 5], [2016, 5], [2017, 6], [2018, 7], [2019, 7], [2020, 4],
    [2021, 7], [2022, 9], [2023, 10], [2024, 11], [2025, 11], [2026, 9]] as const)
  const first = new Date(year, 0, 1), last = year === TODAY.getFullYear() ? addDays(TODAY, -10) : new Date(year, 11, 31)
  return addDays(first, Math.floor(rnd() * ((last.getTime() - first.getTime()) / 86400000)))
}

function person(dept: (typeof HR_DEPARTMENTS)[number], branchId: number, job: Job, left: boolean): Person {
  const [designation, kind] = job
  const female = rnd() < (kind === F ? 0.42 : kind === A ? 0.36 : 0.07)
  const name = `${pick(female ? WOMEN : MEN)} ${pick(female ? WOMEN : rnd() < 0.3 ? MEN : FAMILY)}`.replace(/^(\w+) \1$/, `$1 ${pick(FAMILY)}`)
  let hired = hiredOn()
  let gone: Date | null = null
  if (left) {
    // Most leavers went in the last three years, after at least half a year in the job.
    gone = addDays(TODAY, -Math.floor(between(12, rnd() < 0.75 ? 1000 : 2600)))
    if (addDays(hired, 180) > gone) hired = addDays(gone, -Math.floor(between(200, 1500)))
  }
  const daily = designation === 'SWEEPER' || designation === 'GARDENER'
  let status: string = daily ? weighted([['Daily Wages', 80], ['Contract', 20]] as const)
    : kind === F ? weighted([['Permanent', 68], ['Contract', 16], ['Visiting', 16]] as const)
    : kind === A ? weighted([['Permanent', 74], ['Contract', 26]] as const)
    : weighted([['Permanent', 42], ['Contract', 38], ['Daily Wages', 20]] as const)
  if (!left && status === 'Permanent' && addDays(hired, 180) > TODAY) status = 'Probationary'
  return {
    branchId, departmentId: dept.id, job,
    row: {
      employeeId: 0, code: null, name, designation, department: dept.description, employeeType: kind, employmentStatus: status,
      gender: female ? 'Female' : 'Male', branch: BRANCH_NAME[branchId], hiringDate: iso(hired),
      discontinuationDate: gone ? iso(gone) : null, isActive: !left,
    },
  }
}

const STAFF: Person[] = []
for (const dept of HR_DEPARTMENTS) {
  // Current staff, split between the campuses by the shared shares.
  const atMain = Math.round(dept.employees * HR_BRANCH_SHARE[1]), atCity = Math.round(dept.employees * HR_BRANCH_SHARE[2])
  jobsFor(dept.id, dept.employees).forEach((job, i) => STAFF.push(person(dept, i < atMain ? 1 : i < atMain + atCity ? 2 : 3, job, false)))
  // Roughly one in eleven posts has seen someone leave. Heads of office tend to stay.
  const leavers = jobsFor(dept.id, dept.employees).filter((j) => j[3] < 200000).slice(0, Math.max(1, Math.round(dept.employees / 11)))
  for (const job of leavers) STAFF.push(person(dept, weighted([[1, HR_BRANCH_SHARE[1]], [2, HR_BRANCH_SHARE[2]], [3, HR_BRANCH_SHARE[3]]] as const), job, true))
}
// Employee codes run in the order people joined.
STAFF.sort((a, b) => (a.row.hiringDate ?? '').localeCompare(b.row.hiringDate ?? ''))
STAFF.forEach((s, i) => { s.row.employeeId = 5001 + i; s.row.code = `EMP-${String(i + 1).padStart(4, '0')}` })

/** Current structures: every serving employee but a handful whose structure has not been entered yet. */
const STRUCTURES = new Map<number, SalaryStructureRow>()
for (const s of STAFF) {
  if (!s.row.isActive || rnd() < 0.03) continue
  const [, , low, high] = s.job
  const hired = day(s.row.hiringDate!.slice(0, 10))
  const years = (TODAY.getTime() - hired.getTime()) / (365.25 * 86400000)
  // Longer service sits higher in the band.
  const place = Math.min(1, Math.max(0, years / 14 + between(-0.15, 0.25)))
  const dailyWage = s.row.employmentStatus === 'Daily Wages'
  const ratePerDay = dailyWage ? Math.round((low + (high - low) * place) / 26 / 50) * 50 : 0
  const basicSalary = dailyWage ? ratePerDay * 26 : round500(low + (high - low) * place)
  const totalAllowance = dailyWage ? 0 : round500(basicSalary * between(0.28, 0.42))
  const specialAllowance = !dailyWage && (high >= 150000 || rnd() < 0.2) ? round500(basicSalary * between(0.05, 0.14)) : 0
  // Pay is revised each July; anyone who joined since then is still on the structure they were hired with.
  const revised = day(`${TODAY.getFullYear()}-07-01`)
  STRUCTURES.set(s.row.employeeId, {
    employeeId: s.row.employeeId, code: s.row.code, name: s.row.name, designation: s.row.designation, department: s.row.department,
    employmentStatus: s.row.employmentStatus, branch: s.row.branch,
    basicSalary, specialAllowance, totalAllowance, grossSalary: basicSalary + specialAllowance + totalAllowance, ratePerDay,
    effectiveDate: iso(hired > revised ? hired : rnd() < 0.12 ? day(`${TODAY.getFullYear() - 1}-07-01`) : revised),
  })
}

// ---- routes --------------------------------------------------------------------------------------------------------
const num = (p: URLSearchParams, key: string) => Number(p.get(key)) || null

function staff(p: URLSearchParams, byDepartment = true): Person[] {
  const branchId = num(p, 'branchId'), departmentId = byDepartment ? num(p, 'departmentId') : null
  return STAFF.filter((s) => (!branchId || s.branchId === branchId) && (!departmentId || s.departmentId === departmentId))
}

/** Sample mode only. `p` is the request's query string. */
export function sampleEmployeeDepartments(p: URLSearchParams): EmployeeDepartment[] {
  const active = staff(p, false).filter((s) => s.row.isActive)
  return HR_DEPARTMENTS.map((d) => ({ id: d.id, description: d.description, employees: active.filter((s) => s.departmentId === d.id).length }))
    .filter((d) => d.employees > 0)
}
export function sampleEmployees(p: URLSearchParams): EmployeeRow[] {
  return staff(p).map((s) => ({ ...s.row }))
}
export function sampleSalaryStructure(p: URLSearchParams): SalaryStructureRow[] {
  return staff(p).flatMap((s) => { const row = STRUCTURES.get(s.row.employeeId); return row ? [{ ...row }] : [] })
}

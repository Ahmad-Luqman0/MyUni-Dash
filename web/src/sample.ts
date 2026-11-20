/**
 * Local preview only (npm run dev, ?sample=1): a made-up university so the dashboard can be seen while the test
 * database is nearly empty. Every API route is answered from here, filter lists included, and the rows respect the
 * chosen filters. A seeded generator keeps the numbers the same between reloads. Loaded on demand; never in a build.
 */
import type {
  AdmissionRow, Branch, CollectionRow, Company, DefaulterRow, Degree, Department, DiscountRow, Faculty,
  InstallmentRow, ReceivableRow, RegistrationRow, Semester, SummaryRow,
} from './api'
import { sampleEmployeeDepartments, sampleEmployees, sampleSalaryStructure } from './sampleStaff'
import { sampleAttendance, sampleSalarySheet } from './samplePayroll'

// ---- seeded random -------------------------------------------------------------------------------------------------
let seed = 20261119
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
const guid = (kind: number, n: number) => `${String(kind).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`
const day = (s: string) => new Date(`${s}T00:00:00`)

/** The sample's "today": the Fall-26 semester is in session. */
const TODAY = day('2026-11-19')

// ---- the university ------------------------------------------------------------------------------------------------
const COMPANIES: Company[] = [{ id: 1, companyName: 'MyUni University' }]

const BRANCHES = [
  { id: 1, description: 'MAIN CAMPUS', code: 'MC', city: 'Lahore', share: 0.56 },
  { id: 2, description: 'CITY CAMPUS', code: 'CC', city: 'Islamabad', share: 0.27 },
  { id: 3, description: 'NORTH CAMPUS', code: 'NC', city: 'Peshawar', share: 0.17 },
]

const FACULTIES = [
  { id: guid(1, 1), description: 'FACULTY OF COMPUTING AND ENGINEERING', code: 'FCE' },
  { id: guid(1, 2), description: 'FACULTY OF MANAGEMENT SCIENCES', code: 'FMS' },
  { id: guid(1, 3), description: 'FACULTY OF HEALTH, LAW AND SOCIAL SCIENCES', code: 'FHS' },
]

const DEPARTMENTS = [
  { id: 1, description: 'COMPUTER SCIENCE', faculty: 0 },
  { id: 2, description: 'SOFTWARE ENGINEERING', faculty: 0 },
  { id: 3, description: 'BUSINESS ADMINISTRATION', faculty: 1 },
  { id: 4, description: 'ACCOUNTING AND FINANCE', faculty: 1 },
  { id: 5, description: 'PHARMACY AND REHABILITATION', faculty: 2 },
  { id: 6, description: 'LAW AND PSYCHOLOGY', faculty: 2 },
]

interface Deg { code: string; name: string; dept: number; level: string; base: number; fee: number; sems: number; branches: number[] }
const DEGREES: Deg[] = [
  { code: 'BSCS', name: 'BS COMPUTER SCIENCE', dept: 1, level: 'Bachelor', base: 520, fee: 98000, sems: 8, branches: [1, 2, 3] },
  { code: 'BSSE', name: 'BS SOFTWARE ENGINEERING', dept: 2, level: 'Bachelor', base: 340, fee: 96000, sems: 8, branches: [1, 2, 3] },
  { code: 'BSAI', name: 'BS ARTIFICIAL INTELLIGENCE', dept: 1, level: 'Bachelor', base: 210, fee: 105000, sems: 8, branches: [1, 2] },
  { code: 'MSCS', name: 'MS COMPUTER SCIENCE', dept: 1, level: 'Master', base: 70, fee: 82000, sems: 4, branches: [1, 2] },
  { code: 'BBA', name: 'BBA', dept: 3, level: 'Bachelor', base: 460, fee: 88000, sems: 8, branches: [1, 2, 3] },
  { code: 'MBA', name: 'MBA', dept: 3, level: 'Master', base: 150, fee: 112000, sems: 4, branches: [1, 2, 3] },
  { code: 'BSAF', name: 'BS ACCOUNTING AND FINANCE', dept: 4, level: 'Bachelor', base: 230, fee: 84000, sems: 8, branches: [1, 2, 3] },
  { code: 'PHARMD', name: 'Pharm-D', dept: 5, level: 'Bachelor', base: 380, fee: 142000, sems: 8, branches: [1, 2] },
  { code: 'DPT', name: 'DOCTOR OF PHYSICAL THERAPY', dept: 5, level: 'Bachelor', base: 170, fee: 118000, sems: 8, branches: [1] },
  { code: 'BSPSY', name: 'BS PSYCHOLOGY', dept: 6, level: 'Bachelor', base: 190, fee: 72000, sems: 8, branches: [1, 2, 3] },
  { code: 'LLB', name: 'LLB', dept: 6, level: 'Bachelor', base: 260, fee: 92000, sems: 8, branches: [1, 3] },
  { code: 'MSCP', name: 'MS CLINICAL PSYCHOLOGY', dept: 6, level: 'Master', base: 45, fee: 86000, sems: 4, branches: [1] },
]

const SEMESTERS = [
  { code: 'Spring-25', calendar: '2025', start: '2025-02-03', end: '2025-06-13', kind: 'spring', size: 0.86, paid: 0.992 },
  { code: 'Summer-25', calendar: '2025', start: '2025-06-23', end: '2025-08-15', kind: 'summer', size: 0.15, paid: 0.995 },
  { code: 'Fall-25', calendar: '2025', start: '2025-09-08', end: '2026-01-23', kind: 'fall', size: 0.95, paid: 0.981 },
  { code: 'Spring-26', calendar: '2026', start: '2026-02-02', end: '2026-06-12', kind: 'spring', size: 0.93, paid: 0.957 },
  { code: 'Summer-26', calendar: '2026', start: '2026-06-22', end: '2026-08-14', kind: 'summer', size: 0.18, paid: 0.94 },
  { code: 'Fall-26', calendar: '2026', start: '2026-09-07', end: '2027-01-22', kind: 'fall', size: 1.05, paid: 0.74 },
] as const
const LAST_SEM = SEMESTERS.length - 1

const degId = (i: number) => guid(2, i + 1)
const semId = (i: number) => guid(3, i + 1)
const deptOf = (d: Deg) => DEPARTMENTS[d.dept - 1]
const facOf = (d: Deg) => FACULTIES[deptOf(d).faculty]

// ---- facts, at a finer grain than the API (campus is kept so the campus filter works) ----------------------------------
interface Dim { deg: number; branch: number; sem?: number; date?: Date }

const CHALLAN_TYPES = [
  ['Existing/Old Student (Challan)', 0.67], ['New Admission (Challan)', 0.2], ['Installments (Challan)', 0.1], ['Others (Challan)', 0.03],
] as const

interface Reg extends Dim { sem: number; semesterNo: number; programType: string; students: number }
const regs: Reg[] = []
SEMESTERS.forEach((s, si) => {
  DEGREES.forEach((d, di) => {
    const shifts: [string, number][] = d.level === 'Master' ? [['Evening', 0.56], ['Weekend', 0.44]] : [['Morning', 0.71], ['Evening', 0.29]]
    const branchTotal = d.branches.reduce((a, b) => a + BRANCHES[b - 1].share, 0)
    for (let no = 1; no <= d.sems; no++) {
      // Fall intake is the big one: odd semester numbers fill in fall, even ones in spring.
      const main = s.kind === 'summer' ? true : (no % 2 === 1) === (s.kind === 'fall')
      const step = Math.ceil(no / 2) - 1
      const share = s.kind === 'summer' ? 1 / d.sems : (main ? 0.92 : 0.08) * [0.31, 0.27, 0.23, 0.19][d.sems === 4 ? step * 2 : step] * (d.sems === 4 ? 1.72 : 1)
      for (const b of d.branches) {
        for (const [shift, sw] of shifts) {
          const n = Math.round(d.base * s.size * share * (BRANCHES[b - 1].share / branchTotal) * sw * between(0.9, 1.1))
          if (n > 0) regs.push({ deg: di, branch: b, sem: si, semesterNo: no, programType: shift, students: n })
        }
      }
    }
  })
})

interface Adm extends Dim { sem: number; programType: string; announcements: number; seats: number; admitted: number; feeAmount: number }
const adms: Adm[] = []
for (const r of regs) {
  if (r.semesterNo !== 1 || SEMESTERS[r.sem].kind === 'summer') continue
  const fill = rnd() < 0.2 ? 1 : between(0.7, 1)
  adms.push({
    deg: r.deg, branch: r.branch, sem: r.sem, programType: r.programType, announcements: 1,
    seats: fill === 1 ? r.students : Math.max(10, Math.ceil(r.students / fill / 5) * 5), admitted: r.students,
    feeAmount: DEGREES[r.deg].fee + (SEMESTERS[r.sem].calendar === '2026' ? 6000 : 0),
  })
}

interface Rec extends Dim { sem: number; challanType: string; challans: number; billed: number; received: number; overdueChallans: number; overdue: number; discount: number; fine: number }
const recs: Rec[] = []
{
  const heads = new Map<string, number>()
  for (const r of regs) heads.set(`${r.sem}|${r.deg}|${r.branch}`, (heads.get(`${r.sem}|${r.deg}|${r.branch}`) ?? 0) + r.students)
  for (const [k, students] of heads) {
    const [sem, deg, branch] = k.split('|').map(Number)
    const s = SEMESTERS[sem]
    for (const [type, share] of CHALLAN_TYPES) {
      const challans = Math.round(students * share * between(0.9, 1.15))
      if (!challans) continue
      const billed = Math.round(challans * DEGREES[deg].fee * (s.kind === 'summer' ? 0.35 : 1) * between(0.92, 1.04) / 500) * 500
      const received = Math.round(billed * Math.min(1, s.paid * between(0.97, 1.03)) / 500) * 500
      const overdue = Math.round((billed - received) * (sem === LAST_SEM ? between(0.3, 0.55) : 1) / 500) * 500
      recs.push({
        deg, branch, sem, challanType: type, challans, billed, received, overdue,
        overdueChallans: overdue > 0 ? Math.max(1, Math.round(overdue / DEGREES[deg].fee)) : 0,
        discount: Math.round(billed * between(0.03, 0.08) / 500) * 500, fine: Math.round(billed * between(0, 0.006) / 100) * 100,
      })
    }
  }
}

interface Col extends Dim { date: Date; source: string; challanType: string | null; receipts: number; amount: number }
const cols: Col[] = []
{
  const degWeights = DEGREES.map((d, i) => [i, d.base * d.fee] as const)
  const monthWeight = [0.9, 2.3, 1.7, 0.8, 0.7, 0.6, 0.7, 0.8, 2.6, 1.9, 1.0, 0.8]
  for (let d = day('2025-01-06'); d <= TODAY; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    if (d.getDay() === 0) continue
    const lines = 4 + Math.floor(rnd() * 4)
    for (let i = 0; i < lines; i++) {
      const deg = weighted(degWeights)
      const receipts = 1 + Math.floor(rnd() * 9 * monthWeight[d.getMonth()])
      cols.push({
        deg, branch: weighted(DEGREES[deg].branches.map((b) => [b, BRANCHES[b - 1].share] as const)), date: d,
        source: rnd() < 0.63 ? 'Bank receipt' : 'Cash Fee Receipt',
        challanType: rnd() < 0.04 ? null : weighted(CHALLAN_TYPES),
        receipts, amount: Math.round(receipts * DEGREES[deg].fee * between(0.45, 1) / 100) * 100,
      })
    }
  }
}

const FIRST = ['Ahmed', 'Ayesha', 'Bilal', 'Fatima', 'Hamza', 'Hira', 'Usman', 'Maryam', 'Zain', 'Sana', 'Ali', 'Noor', 'Hassan', 'Iqra', 'Saad', 'Mahnoor', 'Talha', 'Rabia', 'Danish', 'Zainab', 'Faisal', 'Komal', 'Shahzaib', 'Areeba']
const LAST = ['Khan', 'Malik', 'Raza', 'Sheikh', 'Butt', 'Qureshi', 'Chaudhry', 'Siddiqui', 'Javed', 'Iqbal', 'Hussain', 'Aslam', 'Farooq', 'Mirza', 'Rehman', 'Anwar', 'Abbasi', 'Niazi']
interface Def extends Dim { row: DefaulterRow }
const defs: Def[] = []
for (let i = 0; i < 42; i++) {
  const deg = weighted(DEGREES.map((d, di) => [di, d.base] as const))
  const d = DEGREES[deg]
  const daysOverdue = Math.round(4 + Math.pow(rnd(), 1.7) * 210)
  const sem = daysOverdue > 160 ? 3 : daysOverdue > 100 && rnd() < 0.5 ? 4 : LAST_SEM
  const unpaid = 1 + Math.floor(rnd() * 3)
  const totalFee = Math.round(d.fee * between(1, 1.9) / 500) * 500
  const received = Math.round(totalFee * between(0.05, 0.75) / 500) * 500
  const due = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - daysOverdue)
  const s = SEMESTERS[sem].code
  defs.push({
    deg, sem, date: due, branch: weighted(d.branches.map((b) => [b, BRANCHES[b - 1].share] as const)),
    row: {
      studentId: guid(4, i + 1), regNo: `${s[0]}${s.slice(-2)}-${d.code}-${String(100 + Math.floor(rnd() * 800)).padStart(4, '0')}`,
      student: (i % 3 === 0 ? `${pick(FIRST)} ${pick(LAST)}`.toUpperCase() : `${pick(FIRST)} ${pick(LAST)}`),
      degreeCode: d.code, degree: d.name, department: deptOf(d).description, faculty: facOf(d).description,
      programType: d.level === 'Master' ? pick(['Evening', 'Weekend']) : rnd() < 0.7 ? 'Morning' : 'Evening',
      totalFee, received, balance: totalFee - received, unpaidChallans: unpaid, oldestDueDate: iso(due), daysOverdue,
      remarks: rnd() < 0.15 ? null : pick([`${s} tuition challan unpaid`, unpaid === 1 ? '1 installment unpaid' : `${unpaid} installments unpaid`, `${s} tuition and hostel challans unpaid`, 'Cheque returned by bank', 'Requested an extension until next month']),
    },
  })
}

interface Ins extends Dim { date: Date; planStatus: string; state: string; plans: number; installments: number; amount: number }
const inss: Ins[] = []
for (let m = new Date(2025, 0, 1); m <= new Date(2027, 3, 1); m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
  const age = (TODAY.getFullYear() - m.getFullYear()) * 12 + TODAY.getMonth() - m.getMonth() // months ago
  const states: [string, number][] = age > 3 ? [['Paid', 0.97], ['Overdue', 0.03]] : age > 0 ? [['Paid', 0.86], ['Overdue', 0.14]]
    : age === 0 ? [['Paid', 0.5], ['Overdue', 0.08], ['Upcoming', 0.42]] : [['Upcoming', 1]]
  const season = [1.1, 0.7, 1.2, 1.3, 1.1, 0.6, 0.5, 0.6, 0.8, 1.3, 1.4, 1.2][m.getMonth()] * (age < -2 ? 0.55 : 1)
  DEGREES.forEach((d, deg) => {
    for (const b of d.branches) {
      if (rnd() < 0.25) continue
      const count = Math.max(1, Math.round(d.base * BRANCHES[b - 1].share * 0.085 * season * between(0.7, 1.3)))
      for (const [state, share] of states) {
        for (const [planStatus, ps] of [['Approved', state === 'Upcoming' ? 0.8 : 0.96], ['Pending', state === 'Upcoming' ? 0.2 : 0.04]] as const) {
          const n = Math.round(count * share * ps)
          if (!n) continue
          inss.push({ deg, branch: b, date: m, planStatus, state, installments: n, plans: Math.max(1, Math.round(n * 0.85)), amount: Math.round(n * d.fee * 0.25 / 100) * 100 })
        }
      }
    }
  })
}

const DISCOUNT_TYPES = [
  ['Merit Scholarships for Bachelor Studies', 0.34, 0.5], ['Need-based Financial Assistance', 0.27, 0.4], ['Kinship Policy', 0.16, 0.2],
  ['Employee Dependent Waiver', 0.09, 0.5], ['Hafiz-e-Quran Scholarship', 0.08, 0.25], ['Sports Scholarship', 0.06, 0.3],
] as const
interface Dis extends Dim { sem: number; discountType: string; category: string; feeType: string; statusText: string; students: number; amount: number }
const diss: Dis[] = []
for (const r of recs) {
  if (r.challanType !== CHALLAN_TYPES[0][0]) continue
  for (const [type, share, depth] of DISCOUNT_TYPES) {
    if (rnd() < 0.3 || (type.includes('Bachelor') && DEGREES[r.deg].level !== 'Bachelor')) continue
    const students = Math.round(r.challans * 0.16 * share * between(0.6, 1.4))
    if (!students) continue
    diss.push({
      deg: r.deg, branch: r.branch, sem: r.sem, discountType: type, students,
      category: type.startsWith('Merit') || type.startsWith('Sports') ? 'Semester Discount' : rnd() < 0.8 ? 'Degree Discount' : 'Semester Discount',
      feeType: rnd() < 0.82 ? 'TUITION FEE' : rnd() < 0.6 ? 'ADMISSION FEE' : 'HOSTEL FEE',
      statusText: r.sem === LAST_SEM && rnd() < 0.35 ? 'Pending' : 'Approved',
      amount: Math.round(students * DEGREES[r.deg].fee * depth * (SEMESTERS[r.sem].kind === 'summer' ? 0.35 : 1) / 500) * 500,
    })
  }
}

// ---- answering a request -------------------------------------------------------------------------------------------
interface Q { branchId: number; facultyId: string; departmentId: number; degreeId: string; semesterId: string; start: Date | null; end: Date | null }

function parse(p: URLSearchParams): Q {
  return {
    branchId: Number(p.get('branchId')) || 0, facultyId: p.get('facultyId') ?? '', departmentId: Number(p.get('departmentId')) || 0,
    degreeId: p.get('degreeId') ?? '', semesterId: p.get('semesterId') ?? '',
    start: p.get('startDate') ? day(p.get('startDate')!) : null, end: p.get('endDate') ? day(p.get('endDate')!) : null,
  }
}

/** Does a fact row pass the filters? Rows dated by semester match a date range that overlaps the semester. */
function pass(r: Dim, q: Q, monthly = false) {
  const d = DEGREES[r.deg]
  if (q.branchId && r.branch !== q.branchId) return false
  if (q.degreeId && degId(r.deg) !== q.degreeId) return false
  if (q.departmentId && d.dept !== q.departmentId) return false
  if (q.facultyId && facOf(d).id !== q.facultyId) return false
  const sem = q.semesterId ? SEMESTERS.findIndex((_, i) => semId(i) === q.semesterId) : -1
  if (r.date) {
    const from = r.date
    const to = monthly ? new Date(from.getFullYear(), from.getMonth() + 1, 0) : from
    if (q.start && to < q.start) return false
    if (q.end && from > q.end) return false
    if (r.sem === undefined && sem >= 0 && (to < day(SEMESTERS[sem].start) || from > day(SEMESTERS[sem].end))) return false
  }
  if (r.sem !== undefined) {
    if (sem >= 0 && r.sem !== sem) return false
    if (!r.date) {
      if (q.start && day(SEMESTERS[r.sem].end) < q.start) return false
      if (q.end && day(SEMESTERS[r.sem].start) > q.end) return false
    }
  }
  return true
}

const degreeDims = (i: number) => {
  const d = DEGREES[i]
  return { degreeId: degId(i), degreeCode: d.code, degree: d.name, department: deptOf(d).description, faculty: facOf(d).description }
}
const semDims = (i: number) => ({ semesterId: semId(i), semester: SEMESTERS[i].code, semesterStart: `${SEMESTERS[i].start}T00:00:00` })

/** Roll the fine-grained rows up to the grain the API returns. */
function grain<T extends Dim, R>(rows: T[], key: (r: T) => string, make: (r: T) => R, add: (into: R, r: T) => void): R[] {
  const map = new Map<string, R>()
  for (const r of rows) {
    const k = key(r)
    const g = map.get(k)
    if (g) add(g, r)
    else map.set(k, make(r))
  }
  return [...map.values()]
}

function registrations(q: Q): RegistrationRow[] {
  return grain(regs.filter((r) => pass(r, q)), (r) => `${r.sem}|${r.deg}|${r.semesterNo}|${r.programType}`,
    (r) => ({ ...semDims(r.sem), ...degreeDims(r.deg), semesterNo: r.semesterNo, programType: r.programType, students: r.students }),
    (g, r) => { g.students += r.students })
}
function admissions(q: Q): AdmissionRow[] {
  return grain(adms.filter((r) => pass(r, q)), (r) => `${r.sem}|${r.deg}|${r.programType}`,
    (r) => ({ ...semDims(r.sem), ...degreeDims(r.deg), programType: r.programType, announcements: r.announcements, seats: r.seats, admitted: r.admitted, feeAmount: r.feeAmount }),
    (g, r) => { g.announcements += r.announcements; g.seats += r.seats; g.admitted += r.admitted })
}
function collections(q: Q): CollectionRow[] {
  return grain(cols.filter((r) => pass(r, q)), (r) => `${r.date.getTime()}|${r.source}|${r.deg}|${r.challanType}`,
    (r) => ({ receiptDate: iso(r.date), source: r.source, ...degreeDims(r.deg), challanType: r.challanType, receipts: r.receipts, amount: r.amount }),
    (g, r) => { g.receipts += r.receipts; g.amount += r.amount })
}
function receivables(q: Q): ReceivableRow[] {
  return grain(recs.filter((r) => pass(r, q)), (r) => `${r.sem}|${r.deg}|${r.challanType}`,
    (r) => ({ ...semDims(r.sem), ...degreeDims(r.deg), challanType: r.challanType, challans: r.challans, billed: r.billed, received: r.received, overdueChallans: r.overdueChallans, overdue: r.overdue, discount: r.discount, fine: r.fine }),
    (g, r) => { g.challans += r.challans; g.billed += r.billed; g.received += r.received; g.overdueChallans += r.overdueChallans; g.overdue += r.overdue; g.discount += r.discount; g.fine += r.fine })
}
function defaulters(q: Q): DefaulterRow[] {
  return defs.filter((r) => pass({ ...r, date: undefined }, q)).map((r) => r.row).sort((a, b) => b.balance - a.balance)
}
function installments(q: Q): InstallmentRow[] {
  return grain(inss.filter((r) => pass(r, q, true)), (r) => `${r.date.getTime()}|${r.deg}|${r.planStatus}|${r.state}`,
    (r) => ({ month: iso(r.date), ...degreeDims(r.deg), planStatus: r.planStatus, state: r.state, plans: r.plans, installments: r.installments, amount: r.amount }),
    (g, r) => { g.plans += r.plans; g.installments += r.installments; g.amount += r.amount })
}
function discounts(q: Q): DiscountRow[] {
  return grain(diss.filter((r) => pass(r, q)), (r) => `${r.discountType}|${r.category}|${r.feeType}|${r.deg}|${r.statusText}`,
    (r) => ({ discountType: r.discountType, category: r.category, feeType: r.feeType, ...degreeDims(r.deg), statusText: r.statusText, students: r.students, amount: r.amount }),
    (g, r) => { g.students += r.students; g.amount += r.amount })
}

function summary(q: Q): SummaryRow[] {
  const total = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0)
  const r = regs.filter((x) => pass(x, q))
  const latest = Math.max(-1, ...r.map((x) => x.sem))
  const everySem = regs.filter((x) => pass(x, { ...q, semesterId: '', start: null, end: null }))
  const rc = recs.filter((x) => pass(x, q))
  const billed = total(rc, (x) => x.billed), received = total(rc, (x) => x.received)
  return [{
    students: Math.round(total(everySem.filter((x) => x.sem === LAST_SEM), (x) => x.students) * 1.035),
    registeredStudents: total(r.filter((x) => x.sem === latest), (x) => x.students),
    degreeCompleted: Math.round(total(r.filter((x) => x.sem !== LAST_SEM && x.semesterNo === DEGREES[x.deg].sems), (x) => x.students) * 0.93),
    programs: new Set(r.map((x) => x.deg)).size,
    newAdmissions: total(adms.filter((x) => pass(x, q)), (x) => x.admitted),
    billed, received, outstanding: billed - received, overdue: total(rc, (x) => x.overdue),
    defaulters: defaulters(q).length, discounts: total(rc, (x) => x.discount),
    collected: total(cols.filter((x) => pass(x, q)), (x) => x.amount),
  }]
}

export function sampleResponse(url: string): unknown {
  const u = new URL(url, location.origin)
  const p = u.searchParams
  const q = parse(p)
  const route = u.pathname.replace('/api/', '')
  const inScope = (d: Deg) =>
    (!q.branchId || d.branches.includes(q.branchId)) && (!q.facultyId || facOf(d).id === q.facultyId) && (!q.departmentId || d.dept === q.departmentId)
  switch (route) {
    case 'filters/companies': return COMPANIES
    case 'filters/branches':
      return BRANCHES.map((b): Branch => ({
        id: b.id, description: b.description, code: b.code, city: b.city,
        students: regs.filter((r) => r.branch === b.id && r.sem === LAST_SEM).reduce((a, r) => a + r.students, 0),
      }))
    case 'filters/faculties': return FACULTIES.map((f): Faculty => ({ ...f }))
    case 'filters/departments':
      return DEPARTMENTS.filter((d) => !q.facultyId || FACULTIES[d.faculty].id === q.facultyId)
        .map((d): Department => ({ id: d.id, description: d.description, facultyId: FACULTIES[d.faculty].id, faculty: FACULTIES[d.faculty].description }))
    case 'filters/degrees':
      return DEGREES.map((d, i) => ({ d, i })).filter(({ d }) => inScope(d))
        .map(({ d, i }): Degree => ({ id: degId(i), degreeCode: d.code, degreeName: d.name, departmentId: d.dept, degreeLevel: d.level }))
    case 'filters/semesters':
      return SEMESTERS.map((s, i): Semester => ({
        id: semId(i), orderId: i + 1, code: s.code, calendar: s.calendar, startDate: `${s.start}T00:00:00`, endDate: `${s.end}T00:00:00`, isAdmissionOpen: i === LAST_SEM,
        students: regs.filter((r) => r.sem === i && (!q.branchId || r.branch === q.branchId)).reduce((a, r) => a + r.students, 0),
      }))
    case 'dashboard/summary': return summary(q)
    case 'dashboard/registrations': return registrations(q)
    case 'dashboard/admissions': return admissions(q)
    case 'dashboard/collections': return collections(q)
    case 'dashboard/receivables': return receivables(q)
    case 'dashboard/defaulters': return defaulters(q)
    case 'dashboard/installments': return installments(q)
    case 'dashboard/discounts': return discounts(q)
    case 'filters/employee-departments': return sampleEmployeeDepartments(p)
    case 'dashboard/employees': return sampleEmployees(p)
    case 'dashboard/salaryStructure': return sampleSalaryStructure(p)
    case 'dashboard/salarySheet': return sampleSalarySheet(p)
    case 'dashboard/attendance': return sampleAttendance(p)
    default: return []
  }
}

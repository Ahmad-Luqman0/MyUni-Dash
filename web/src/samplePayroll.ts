import type { AttendanceRow, SalarySheetRow } from './api'
import { HR_BRANCH_SHARE, HR_DEPARTMENTS, HR_TODAY } from './sampleHrBase'

/** Sample mode only: 24 months of made-up payroll and attendance for the departments in sampleHrBase. `p` is the request's query string. */

const BRANCH_NAME: Record<number, string> = { 1: 'Main Campus', 2: 'City Campus', 3: 'North Campus' }
const MONTHS = 24
/** How each department's absence and lateness compare with the average, so the departments do not all look alike. */
const HABIT: Record<number, { absence: number; late: number }> = {
  101: { absence: 0.85, late: 1.15 }, 102: { absence: 1.0, late: 1.0 }, 103: { absence: 0.75, late: 0.8 }, 104: { absence: 1.1, late: 1.3 },
  105: { absence: 0.9, late: 0.9 }, 106: { absence: 1.2, late: 0.7 }, 107: { absence: 0.7, late: 0.6 }, 108: { absence: 1.0, late: 1.2 },
  109: { absence: 1.4, late: 1.0 }, 110: { absence: 0.8, late: 0.75 },
}

/** Monthly pay per head in PKR when the sample starts, the share paid as allowances on top, and whether the department works overtime. */
const PAY: Record<number, { basic: number; allowance: number; tax: number; overtime: number }> = {
  101: { basic: 135000, allowance: 0.42, tax: 0.088, overtime: 0 },
  102: { basic: 125000, allowance: 0.4, tax: 0.084, overtime: 0 },
  103: { basic: 140000, allowance: 0.42, tax: 0.09, overtime: 0 },
  104: { basic: 130000, allowance: 0.4, tax: 0.086, overtime: 0 },
  105: { basic: 115000, allowance: 0.38, tax: 0.08, overtime: 0 },
  106: { basic: 70000, allowance: 0.3, tax: 0.068, overtime: 0 },
  107: { basic: 80000, allowance: 0.32, tax: 0.072, overtime: 0.012 },
  108: { basic: 85000, allowance: 0.32, tax: 0.074, overtime: 0.03 },
  109: { basic: 42000, allowance: 0.28, tax: 0.06, overtime: 0.055 },
  110: { basic: 55000, allowance: 0.3, tax: 0.063, overtime: 0 },
}

/** A small seeded generator (mulberry32), so the sample's figures are the same on every load. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Tagged<T> { branchId: number; departmentId: number; ym: string; row: T }

function build() {
  const rnd = seeded(20261119)
  const between = (lo: number, hi: number) => lo + rnd() * (hi - lo)
  const [ty, tm] = HR_TODAY.split('-').map(Number)
  const pay: Tagged<SalarySheetRow>[] = [], att: Tagged<AttendanceRow>[] = []

  for (let i = 0; i < MONTHS; i++) {
    const d = new Date(ty, tm - 1 - (MONTHS - 1 - i), 1)
    const y = d.getFullYear(), m = d.getMonth() + 1 // 1..12
    const ym = `${y}-${String(m).padStart(2, '0')}`, month = `${ym}-01T00:00:00`
    // Annual increment every July; the first month of the sample is the base.
    const first = new Date(ty, tm - MONTHS, 1)
    let julys = 0
    for (let k = new Date(first); k <= d; k = new Date(k.getFullYear(), k.getMonth() + 1, 1)) if (k.getMonth() === 6 && k > first) julys++
    const raise = Math.pow(1.08, julys)
    const staffing = 0.88 + 0.12 * (i / (MONTHS - 1)) // head count grows slowly to today's
    // Weekdays in the month, less a public holiday or two.
    let weekdays = 0
    for (let k = new Date(y, m - 1, 1); k.getMonth() === m - 1; k = new Date(y, m - 1, k.getDate() + 1)) if (k.getDay() !== 0 && k.getDay() !== 6) weekdays++
    const workingDays = weekdays - (m === 3 || m === 6 || m === 8 || m === 12 ? 1 : 0)
    const leaveSeason = m === 7 || m === 8 ? 0.035 : m === 12 ? 0.022 : 0

    for (const dep of HR_DEPARTMENTS) {
      const cfg = PAY[dep.id]
      for (const b of [1, 2, 3]) {
        const employees = Math.max(1, Math.round(dep.employees * HR_BRANCH_SHARE[b] * staffing))
        const tag = { branchId: b, departmentId: dep.id, ym }
        const perHead = cfg.basic * raise * (b === 1 ? 1 : b === 2 ? 0.97 : 0.94) * between(0.985, 1.015)

        const basicSalary = Math.round(perHead * employees)
        const overTime = Math.round(basicSalary * cfg.overtime * between(0.6, 1.4))
        const arrears = julys > 0 && m === 7 ? Math.round(basicSalary * between(0.01, 0.02)) : 0 // back pay with the increment
        const allowances = Math.round(basicSalary * cfg.allowance * between(0.97, 1.03)) + overTime + arrears
        const grossSalary = basicSalary + allowances
        const incomeTax = Math.round(grossSalary * cfg.tax * between(0.94, 1.06))
        const eobi = employees * 370
        const providentFund = Math.round(basicSalary * 0.03 * between(0.8, 0.95)) // not every employee is a member
        const loans = Math.round(grossSalary * between(0.004, 0.016))
        const deductions = Math.round(grossSalary * between(0.004, 0.012))
        pay.push({ ...tag, row: {
          month, department: dep.description, branch: BRANCH_NAME[b], sheets: employees, employees,
          basicSalary, allowances, overTime, arrears, grossSalary, deductions, loans, incomeTax, eobi, providentFund,
          netPay: grossSalary - (deductions + loans + eobi + incomeTax + providentFund),
        } })

        const due = employees * workingDays
        const habit = HABIT[dep.id]
        const absences = Math.round(due * between(0.014, 0.022) * habit.absence)
        const leaves = Math.round(due * (between(0.03, 0.06) + leaveSeason))
        const support = dep.id >= 106
        const lateArrivals = Math.round(employees * between(support ? 0.5 : 0.9, support ? 1.3 : 2.1))
        att.push({ ...tag, row: {
          month, department: dep.description, branch: BRANCH_NAME[b], employees,
          daysWorked: due - absences - leaves, absences, leaves, lateArrivals,
          earlyDepartures: Math.round(employees * between(0.1, 0.5)), lateMinutes: Math.round(lateArrivals * between(13, 21) * habit.late),
          overTimeAmount: overTime, deductionAmount: Math.round(absences * (perHead / 30) * between(0.5, 0.8)),
        } })
      }
    }
  }
  return { pay, att }
}

let built: ReturnType<typeof build> | null = null
const data = () => (built ??= build())

/** Campus, staff department and the date range (which picks whole months). */
function pick<T>(rows: Tagged<T>[], p: URLSearchParams): T[] {
  const branchId = Number(p.get('branchId')) || 0, departmentId = Number(p.get('departmentId')) || 0
  const from = (p.get('startDate') ?? '').slice(0, 7), to = (p.get('endDate') ?? '').slice(0, 7)
  return rows
    .filter((r) => (!branchId || r.branchId === branchId) && (!departmentId || r.departmentId === departmentId) && (!from || r.ym >= from) && (!to || r.ym <= to))
    .map((r) => r.row)
}

export function sampleSalarySheet(p: URLSearchParams): SalarySheetRow[] { return pick(data().pay, p) }
export function sampleAttendance(p: URLSearchParams): AttendanceRow[] { return pick(data().att, p) }

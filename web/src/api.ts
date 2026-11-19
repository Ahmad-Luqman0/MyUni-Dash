/** Types and URLs for the MyUni API (see the API contract). JSON keys are the procedures' columns in camelCase. */

export interface Company { id: number; companyName: string }
export interface Branch { id: number; description: string; code: string | null; city: string | null; students: number }
export interface Faculty { id: string; description: string; code: string | null }
export interface Department { id: number; description: string; facultyId: string | null; faculty: string | null }
export interface Degree { id: string; degreeCode: string | null; degreeName: string; departmentId: number | null; degreeLevel: string | null }
export interface Semester {
  id: string; code: string; calendar: string | null; startDate: string | null; endDate: string | null
  isAdmissionOpen: boolean | null; students: number
}

/** The shared filters. null means "all". */
export interface Query {
  companyId: number
  branchId: number | null
  facultyId: string | null
  departmentId: number | null
  degreeId: string | null
  semesterId: string | null
  startDate: string | null
  endDate: string | null
}

interface DegreeDims { degreeId: string | null; degreeCode: string | null; degree: string | null; department: string | null; faculty: string | null }
interface SemesterDims { semesterId: string | null; semester: string | null; semesterStart: string | null }

export interface SummaryRow {
  students: number; registeredStudents: number; degreeCompleted: number; programs: number; newAdmissions: number
  billed: number; received: number; outstanding: number; overdue: number; defaulters: number; discounts: number; collected: number
}
export interface RegistrationRow extends SemesterDims, DegreeDims { semesterNo: number | null; programType: string | null; students: number }
export interface AdmissionRow extends SemesterDims, DegreeDims {
  programType: string | null; announcements: number; seats: number; admitted: number; feeAmount: number
}
export interface CollectionRow extends DegreeDims { receiptDate: string; source: string; challanType: string | null; receipts: number; amount: number }
export interface ReceivableRow extends SemesterDims, DegreeDims {
  challanType: string | null; challans: number; billed: number; received: number
  overdueChallans: number; overdue: number; discount: number; fine: number
}
export interface DefaulterRow {
  studentId: string; regNo: string | null; student: string | null; degreeCode: string | null; degree: string | null
  department: string | null; faculty: string | null; programType: string | null
  totalFee: number; received: number; balance: number; unpaidChallans: number
  oldestDueDate: string | null; daysOverdue: number; remarks: string | null
}
export interface InstallmentRow extends DegreeDims { month: string; planStatus: string; state: string; plans: number; installments: number; amount: number }
export interface DiscountRow extends DegreeDims {
  discountType: string | null; category: string | null; feeType: string | null; statusText: string | null; students: number; amount: number
}

/** HR portions: staff, pay and attendance. They use only companyId, branchId, departmentId (the employee's department) and the dates. */
export interface EmployeeDepartment { id: number; description: string; employees: number }
export interface EmployeeRow {
  employeeId: number; code: string | null; name: string | null; designation: string | null; department: string | null
  employeeType: string | null; employmentStatus: string | null; gender: string | null; branch: string | null
  hiringDate: string | null; discontinuationDate: string | null; isActive: boolean
}
export interface SalaryStructureRow {
  employeeId: number; code: string | null; name: string | null; designation: string | null; department: string | null
  employmentStatus: string | null; branch: string | null
  basicSalary: number; specialAllowance: number; totalAllowance: number; grossSalary: number; ratePerDay: number; effectiveDate: string | null
}
export interface SalarySheetRow {
  month: string; department: string | null; branch: string | null; sheets: number; employees: number
  basicSalary: number; allowances: number; overTime: number; arrears: number; grossSalary: number
  deductions: number; loans: number; incomeTax: number; eobi: number; providentFund: number; netPay: number
}
export interface AttendanceRow {
  month: string; department: string | null; branch: string | null; employees: number
  daysWorked: number; absences: number; leaves: number; lateArrivals: number; earlyDepartures: number; lateMinutes: number
  overTimeAmount: number; deductionAmount: number
}

export type Portion = 'summary' | 'registrations' | 'admissions' | 'collections' | 'receivables' | 'defaulters' | 'installments' | 'discounts'
  | 'employees' | 'salaryStructure' | 'salarySheet' | 'attendance'

function qs(values: Record<string, string | number | null | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(values)) if (v !== null && v !== undefined && v !== '' && v !== 0) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** Where the API lives. Empty (the default) means the same site: `/api/...`, which the Vite dev server proxies.
 *  On a host without that proxy (Vercel), set VITE_API_URL to the API's address without the trailing `/api`,
 *  e.g. https://example.com/MyUni; requests then go to https://example.com/MyUni/api/... */
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim().replace(/\/+$/, '')

export const urls = {
  companies: () => '/api/filters/companies',
  branches: (companyId: number) => `/api/filters/branches${qs({ companyId })}`,
  faculties: (companyId: number) => `/api/filters/faculties${qs({ companyId })}`,
  departments: (companyId: number, facultyId: string | null) => `/api/filters/departments${qs({ companyId, facultyId })}`,
  degrees: (companyId: number, branchId: number | null, facultyId: string | null, departmentId: number | null) =>
    `/api/filters/degrees${qs({ companyId, branchId, facultyId, departmentId })}`,
  semesters: (companyId: number, branchId: number | null) => `/api/filters/semesters${qs({ companyId, branchId })}`,
  employeeDepartments: (companyId: number, branchId: number | null) => `/api/filters/employee-departments${qs({ companyId, branchId })}`,
  portion: (portion: Portion, q: Query) => `/api/dashboard/${portion}${qs({ ...q })}`,
}

/** Local preview only (npm run dev, ?sample=1): every request is answered with made-up university data. */
export const SAMPLE_MODE = import.meta.env.DEV && new URLSearchParams(location.search).has('sample')

export class ApiError extends Error {}

/** GET a JSON array. Errors are worded for the person reading the dashboard. */
export async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  if (SAMPLE_MODE) {
    const { sampleResponse } = await import('./sample')
    await new Promise((r) => setTimeout(r, 220))
    return sampleResponse(url) as T
  }
  let res: Response
  try {
    res = await fetch(API_BASE + url, { signal })
  } catch (e) {
    if (signal.aborted) throw e
    throw new ApiError('The server could not be reached. Check that the MyUni API is running and that you are on the university network.')
  }
  if (!res.ok) {
    throw new ApiError(res.status >= 500
      ? `The server answered with an error (${res.status}). The MyUni API may be stopped, or its database procedures may not be set up yet.`
      : `The server answered with an error (${res.status}) for this request.`)
  }
  try {
    return (await res.json()) as T
  } catch (e) {
    if (signal.aborted) throw e
    throw new ApiError('The server answered, but not with data the dashboard can read.')
  }
}

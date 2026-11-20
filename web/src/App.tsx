import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { AlarmClock, BadgePercent, Banknote, CalendarCheck, CalendarClock, FlaskConical, GraduationCap, IdCard, LayoutDashboard, ReceiptText, Scale, UserPlus, WalletCards } from 'lucide-react'
import { SAMPLE_MODE, urls, type Branch, type Company, type Degree, type Department, type EmployeeDepartment, type Faculty, type Query, type Semester } from './api'
import { useData } from './useData'
import { Rail, type NavItem } from './components/Rail'
import { currentSemester, SemesterStrip } from './components/SemesterStrip'
import { FilterBar, type Selection } from './components/FilterBar'
import { DashContext, type DashActions } from './context'
import { ErrorState } from './components/ui'
import { type SectionProps } from './sections/helpers'
import { Overview } from './sections/Overview'
import { Students } from './sections/Students'
import { Admissions } from './sections/Admissions'
import { Collections } from './sections/Collections'
import { Receivables } from './sections/Receivables'
import { Defaulters } from './sections/Defaulters'
import { Installments } from './sections/Installments'
import { Discounts } from './sections/Discounts'
import { Employees } from './sections/Employees'
import { SalaryStructure } from './sections/SalaryStructure'
import { SalarySheet } from './sections/SalarySheet'
import { Attendance } from './sections/Attendance'

interface SectionDef extends NavItem { title: string; blurb: string; view: ComponentType<SectionProps> }

const SECTIONS: SectionDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, view: Overview, title: 'Overview', blurb: 'Students, admissions and fee money at a glance.' },
  { id: 'students', label: 'Students', icon: GraduationCap, view: Students, title: 'Students', blurb: 'Who is registered, in which degree, semester and shift.' },
  { id: 'admissions', label: 'Admissions', icon: UserPlus, view: Admissions, title: 'Admissions', blurb: 'Seats announced and how many of them were filled.' },
  { id: 'collections', label: 'Collections', icon: ReceiptText, view: Collections, title: 'Collections', blurb: 'Money actually received, by day, source and degree.' },
  { id: 'receivables', label: 'Receivables', icon: Scale, view: Receivables, title: 'Receivables', blurb: 'Total challan amount, what has been paid and what is still unpaid.' },
  { id: 'defaulters', label: 'Defaulters', icon: AlarmClock, view: Defaulters, title: 'Defaulters', blurb: 'Students whose fee is unpaid past its due date.' },
  { id: 'installments', label: 'Installments', icon: CalendarClock, view: Installments, title: 'Installments', blurb: 'Fee paid in parts: what is paid, late and still to come.' },
  { id: 'discounts', label: 'Discounts', icon: BadgePercent, view: Discounts, title: 'Discounts', blurb: 'Scholarships and fee discounts given to students.' },
  { id: 'employees', label: 'Employees', icon: IdCard, view: Employees, title: 'Employees', blurb: 'Who works here: head count by department, role and type of employment.' },
  { id: 'salary-structure', label: 'Salary structure', icon: WalletCards, view: SalaryStructure, title: 'Salary structure', blurb: 'What each employee is set to earn: basic pay, allowances and gross.' },
  { id: 'salary-sheet', label: 'Salary sheet', icon: Banknote, view: SalarySheet, title: 'Salary sheet', blurb: 'Payroll actually run each month: gross, deductions and net pay.' },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, view: Attendance, title: 'Attendance', blurb: 'Days worked, absences, leave and late arrivals each month.' },
]

/** The HR pages. They use the company, campus, employee department and dates only: no semester, faculty or degree. */
const HR_SECTIONS = new Set(['employees', 'salary-structure', 'salary-sheet', 'attendance'])

const sectionFromHash = () => SECTIONS.find((s) => `#${s.id}` === location.hash)?.id ?? 'overview'

const EMPTY: Selection = { companyId: null, branchId: null, facultyId: null, departmentId: null, hrDepartmentId: null, degreeId: null, semesterId: undefined, startDate: '', endDate: '' }

/**
 * A chosen id only counts while it is still in its list, so changing a parent filter drops a child it no longer offers.
 * A list that is loading or failed cannot rule an id out.
 */
function still<K>(id: K | null, list: { data: { id: K }[] | null; loading: boolean }): K | null {
  if (id === null || list.loading || !list.data) return id
  return list.data.some((x) => x.id === id) ? id : null
}

const validDate = (d: string) => (/^(19|20)\d\d-\d\d-\d\d$/.test(d) ? d : null)

export default function App() {
  const [section, setSection] = useState(sectionFromHash)
  const [sel, setSel] = useState<Selection>(EMPTY)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (id: string) => { history.replaceState(null, '', `${location.pathname}${location.search}#${id}`); setSection(id); window.scrollTo({ top: 0 }) }

  // Filter lists. Each depends on its parents: campuses, faculties and semesters on the company; departments on the
  // faculty; degrees on campus, faculty and department.
  const companies = useData<Company[]>(urls.companies(), reload)
  const companyId = sel.companyId ?? companies.data?.[0]?.id ?? null
  const branches = useData<Branch[]>(companyId ? urls.branches(companyId) : null, reload)
  const faculties = useData<Faculty[]>(companyId ? urls.faculties(companyId) : null, reload)
  const branchId = still(sel.branchId, branches)
  const facultyId = still(sel.facultyId, faculties)
  const departments = useData<Department[]>(companyId ? urls.departments(companyId, facultyId) : null, reload)
  const departmentId = still(sel.departmentId, departments)
  const degrees = useData<Degree[]>(companyId ? urls.degrees(companyId, branchId, facultyId, departmentId) : null, reload)
  const degreeId = still(sel.degreeId, degrees)
  const semesters = useData<Semester[]>(companyId ? urls.semesters(companyId, branchId) : null, reload)
  // Until a semester is picked, the current one is chosen. The figures wait for the semester list so they are not
  // loaded twice (once for all semesters, then for the current one); if the list fails, they show all semesters.
  const semesterPending = sel.semesterId === undefined && semesters.loading
  const semesterId = sel.semesterId === undefined
    ? (semesters.loading ? null : currentSemester(semesters.data ?? []))
    : still(sel.semesterId, semesters)
  // The HR pages have their own department list (the employees' departments) and their own choice from it.
  const hr = HR_SECTIONS.has(section)
  const hrDepartments = useData<EmployeeDepartment[]>(hr && companyId ? urls.employeeDepartments(companyId, branchId) : null, reload)
  const hrDepartmentId = still(sel.hrDepartmentId, hrDepartments)

  // A half-typed date (year 0002, or five digits) is not sent to the server.
  const startDate = validDate(sel.startDate), endDate = validDate(sel.endDate)
  const q = useMemo<Query | null>(() => (companyId === null ? null : hr
    ? { companyId, branchId, facultyId: null, departmentId: hrDepartmentId, degreeId: null, semesterId: null, startDate, endDate }
    : semesterPending ? null
    : { companyId, branchId, facultyId, departmentId, degreeId, semesterId, startDate, endDate }
  ), [hr, companyId, branchId, facultyId, departmentId, hrDepartmentId, degreeId, semesterId, semesterPending, startDate, endDate])

  const change = useCallback((patch: Partial<Selection>) => setSel((s) => ({ ...s, ...patch })), [])
  const refresh = useCallback(() => setReload((n) => n + 1), [])

  // Only the filters that apply on the current page can be narrowing it, and only those are cleared.
  const actions = useMemo<DashActions>(() => {
    const narrowed: string[] = []
    if (hr) {
      if (startDate || endDate) narrowed.push('the dates')
      if (branchId) narrowed.push('the campus')
      if (hrDepartmentId) narrowed.push('the department')
      return { retry: refresh, narrowed, clearFilters: () => setSel((s) => ({ ...s, branchId: null, hrDepartmentId: null, startDate: '', endDate: '' })) }
    }
    if (semesterId) narrowed.push(`the semester (${semesters.data?.find((s) => s.id === semesterId)?.code ?? 'chosen'})`)
    if (startDate || endDate) narrowed.push('the dates')
    if (branchId) narrowed.push('the campus')
    if (degreeId) narrowed.push('the degree')
    else if (departmentId) narrowed.push('the department')
    else if (facultyId) narrowed.push('the faculty')
    return { retry: refresh, narrowed, clearFilters: () => setSel((s) => ({ ...EMPTY, companyId: s.companyId, hrDepartmentId: s.hrDepartmentId, semesterId: null })) }
  }, [hr, hrDepartmentId, semesterId, semesters.data, startDate, endDate, branchId, degreeId, departmentId, facultyId, refresh])

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  const View = current.view
  const listsBusy = companies.loading || branches.loading || (hr
    ? hrDepartments.loading
    : faculties.loading || departments.loading || degrees.loading || semesters.loading)

  return (
    <DashContext.Provider value={actions}>
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm">Skip to the figures</a>
      <Rail items={SECTIONS} current={current.id} onSelect={go} />
      <div className="lg:pl-60">
        <div className="mx-auto max-w-[1360px] space-y-4 px-4 pt-4 pb-12 sm:px-6 lg:px-8 lg:pt-6">
          {SAMPLE_MODE && (
            <p role="note" className="flex items-start gap-2.5 rounded-lg border border-chalk bg-chalk-soft px-4 py-2.5 text-sm text-ink">
              <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span><span className="font-semibold">Sample data.</span> Every figure on this page is made up so the dashboard can be previewed. Remove <code className="font-sans font-medium">?sample=1</code> from the address to see the university’s real records.</span>
            </p>
          )}

          {companies.error ? (
            <ErrorState noun="the dashboard" message={companies.error} />
          ) : companies.data && companies.data.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface px-5 py-14 text-center">
              <p className="font-display text-xl font-semibold text-ink">No companies are set up yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">The dashboard needs at least one company in the ERP. Once one is added, select Refresh.</p>
            </div>
          ) : (
            <>
              {!hr && <SemesterStrip state={semesters} selected={semesterId} onSelect={(id) => change({ semesterId: id })} onRetry={refresh} />}
              <FilterBar hr={hr} sel={{ ...sel, companyId, branchId, facultyId, departmentId, hrDepartmentId, degreeId, semesterId }} change={change} busy={listsBusy} onRefresh={refresh}
                lists={{ companies: companies.data, branches: branches.data, faculties: faculties.data, departments: hr ? hrDepartments.data : departments.data, degrees: degrees.data }} />
              <main id="content" className="space-y-4 pt-2">
                <header>
                  <h1 className="text-[28px] leading-tight font-semibold text-ink sm:text-[32px]">{current.title}</h1>
                  <p className="mt-1 text-[15px] text-ink-2">{current.blurb}</p>
                </header>
                <View key={current.id} q={q} reload={reload} />
              </main>
            </>
          )}
        </div>
      </div>
    </DashContext.Provider>
  )
}

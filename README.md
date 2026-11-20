# MyUni Dashboard

University dashboard: students, admissions and fee money (collections, receivables, defaulters, installments, discounts) from the ERP's `UNI*` tables, plus staff, salaries and attendance from its HR tables. Read live from the ERP database (SAC400).

| Folder / file | What it is |
|---|---|
| `web/` | React + Vite + Tailwind + Recharts front end. |
| `backend/` | ASP.NET Core Web API (built for .NET 5, which the server runs, and .NET 10 for local use). Calls the `dbo.Dashboard_MyUni_*` procedures and serves `/api/*`. |
| `SP's/` | The 13 procedures: one for the filter lists and one per tab. Edit these. |
| `all.txt` | All 13 procedures in one script for SSMS (with `GO`). Generated; don't edit by hand. |
| `mac.txt` | The same for DBeaver on Mac (no `GO` lines). Generated; don't edit by hand. |
| `tools/db/make_scripts.mjs` | Rebuilds `all.txt` and `mac.txt` from `SP's/` (`node tools/db/make_scripts.mjs`). Writes files only. |
| `tools/db/requires.json` | The tables, views and columns the procedures read. The scripts check these exist before changing anything. |
| `tools/db/query.mjs` | Quick table / query checks against the database in `.env`: `npm run db -- tables UNI`, `columns dbo.UNIStudents`, `procs Dashboard_MyUni`, or `"SELECT ..."`. Keep it to SELECTs. |

```
Browser ──> web/ (Vite, :5183)
              └─ /api/* ──> backend/MyUni.API (:5186)
                               └─ SQL Server SAC400: dbo.Dashboard_MyUni_*  (one for the filter lists, one per tab)
```

## The procedures

They only read the ERP tables: they call no other procedure and change no table. Run `mac.txt` (DBeaver) or `all.txt` (SSMS) on the database to create or update all of them; check the `USE` line first.

| # | Procedure | Used by | Returns |
|---|---|---|---|
| 01 | `Dashboard_MyUni_Filters` | Filter bar and semester strip | One list per call, picked by `@Section`: Companies, Branches, Faculties, Departments, Degrees, Semesters, EmployeeDepartments |
| 02 | `Dashboard_MyUni_StudentSummary` | Overview | One row of headline numbers |
| 03 | `Dashboard_MyUni_Registrations` | Students | Students per semester, degree, semester number, shift |
| 04 | `Dashboard_MyUni_Admissions` | Admissions | Seats announced and students admitted |
| 05 | `Dashboard_MyUni_Collections` | Collections | Money received per day, source, degree, challan type |
| 06 | `Dashboard_MyUni_Receivables` | Receivables | Total challan, paid, unpaid, overdue per semester, degree, challan type |
| 07 | `Dashboard_MyUni_Defaulters` | Defaulters | One row per student with an overdue balance |
| 08 | `Dashboard_MyUni_Installments` | Installments | Installments per month, degree, plan status, state |
| 09 | `Dashboard_MyUni_Discounts` | Discounts | Discounts per type, category, fee type, degree, status |
| 10 | `Dashboard_MyUni_Employees` | Employees | One row per employee: department, designation, employment status, hired and left dates |
| 11 | `Dashboard_MyUni_SalaryStructure` | Salary structure | One row per employee with a current structure: basic, allowances, gross |
| 12 | `Dashboard_MyUni_SalarySheet` | Salary sheet | Payroll per month, department, branch: gross, deductions, tax, net pay |
| 13 | `Dashboard_MyUni_Attendance` | Attendance | Per month, department, branch: days worked, absences, leaves, late arrivals, overtime |

The scripts also drop the six separate filter-list procedures of the first version (`Dashboard_MyUni_CompanyList` and so on), which `Dashboard_MyUni_Filters` replaces.

The data procedures (02 to 13) take the same filters: `@CompanyId, @BranchId, @FacultyId, @DepartmentId, @DegreeId, @SemesterId, @StartDate, @EndDate` (NULL, or 0 for the numbers, means all).

## What is counted

Every tab follows the From and To dates. What "in the dates" means depends on the figure:

| Figure | Follows the dates by |
|---|---|
| Students, registrations, admissions | Semesters that overlap the dates |
| Total challan, paid, unpaid, discounts | Challan date |
| Collected | Receipt date |
| Overdue, defaulters | Challans that fell due in the dates, judged on the To date (never a day that has not come yet) |
| Installments | Installment month |
| Discount tab | Discount start date |
| Employees | Who was employed at some point in the dates; active means still employed on the To date |
| Salary structure | The structure in force on the To date (From is not used) |
| Salary sheet, attendance | Sheet / submission month |

With no dates chosen, everything is counted and overdue is judged as of today.

The rules follow the ERP's own reports so the numbers match them.

- **Registered students** (`UNIStudents_Rp_GetRegisteredStudent`): active registrations of active students, in the semester they registered in (`RegisterInId`; the first semester when that is empty).
- **Total challan** (`Billed` in the procedures): net amount of challans that are open or paid (`ChallanStatus` 4, 62), full-fee and installment challans alike.
- **Paid** (`Received`): net amount of paid challans (`ChallanStatus` 62). **Unpaid** = Total challan - Paid = the open challans (`ChallanStatus` 4).
- **Overdue**: an open challan (`ChallanStatus` 4) whose validity date (else due date) has passed.
- **Defaulter** (rules of the ERP report `UNIStudents_Rp_GetDefaulterData`): total fee = main challans (`ParentIdGuid` empty) not expired or cancelled (`ChallanStatus` not 3, 40); received = paid challans (`ChallanStatus` 1, 62); the balance is above zero and the student has a challan whose validity date has passed. A student still on 'Admission Offer' is listed only once a challan is paid. Remarks list the challans still open (not 1, 62, 3, 40, 63, 64) past their validity date.
- **Collected**: cash fee receipts of university students (`AEOFeeReceipts`, not deleted, `FeeStatus` 4 received or 19 approved, not against a cancelled challan), plus bank receipt lines that are verified (`DocStatus` 35) on an approved or posted upload (`BankReceiptStatus` 2, 34). A cash fee receipt whose challan already has a verified bank receipt is left out so nothing is counted twice. The ERP saves a university fee receipt with `FeeStatus` 4 and marks its challan paid at once, so 4 is money received.
- **Employees**: active employees of the company (`Employees.Status = 1`, not discontinued), plus those who have left so leavers can be counted. The HR tabs filter by the employee's own department, not the academic one.
- **Salary structure**: each active employee's current structure (`HRMSalaryStructure.Status = 1`, latest by effective date).
- **Salary sheet** (`HRMSalarySheet_Rp_GetByMonth`): gross = basic + allowances; net pay = gross - (deductions + loans + EOBI + income tax + provident fund), which adds up to the sheet's own `NetAmount`. Sheets are counted whatever their approval status.
- **Attendance**: the monthly attendance submitted for payroll (`HRMAttendenceApproval` and its employee lines), whatever its approval status.

## Updating the live database

1. Open `all.txt` (SSMS) or `mac.txt` (DBeaver) and check that the `USE` line names the live database.
2. Run the whole script. It first checks that every table, view and column the procedures read exists in that database. If something is missing it stops with an error naming it and changes nothing. Otherwise it drops and re-creates the 13 `Dashboard_MyUni_*` procedures (and removes the six retired filter-list procedures if they are there). It changes no table and no other procedure, and can be run again safely.
3. Point the API at the live database: in `backend/MyUni.API/appsettings.json` set the live connection string and list the web site's address under `Cors:AllowedOrigins`. (`Database:RequireApprovedReceipts` is no longer used by the procedures.)

## Publishing for the server

The IIS server has the .NET 5 runtime, so publish the .NET 5 build:

```
cd backend
dotnet publish MyUni.API -c Release -f net5.0 -o publish
```

Copy the contents of `backend/publish` to the site folder, keeping the server's own `appsettings.json`. The code keeps to what .NET 5 offers (no `DateOnly`, no minimal hosting) so the same source also builds for .NET 10.

## Running locally

API (copy `backend/MyUni.API/appsettings.example.json` to `appsettings.json` and fill in the connection string first; .NET 10 SDK):

```
cd backend
dotnet run --project MyUni.API -f net10.0 --launch-profile http     # http://localhost:5186
```

Web:

```
cd web
npm install
npm run dev                                              # http://localhost:5183
```

`http://localhost:5183/?sample=1` shows made-up numbers (labelled as sample) to preview the layout when the database has little university data. It only works in `npm run dev`.

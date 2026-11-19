# MyUni Dashboard

University dashboard: students, admissions and fee money (collections, receivables, defaulters, installments, discounts), read live from the ERP database (SAC400, tables `UNI*`).

| Folder / file | What it is |
|---|---|
| `web/` | React + Vite + Tailwind + Recharts front end. |
| `backend/` | ASP.NET Core (.NET 10) Web API. Calls the `dbo.Dashboard_MyUni_*` procedures and serves `/api/*`. |
| `SP's/` | The 14 procedures, one file per portion of the dashboard. Edit these. |
| `all.txt` | All 14 procedures in one script for SSMS (with `GO`). Generated; don't edit by hand. |
| `mac.txt` | The same for DBeaver on Mac (no `GO` lines). Generated; don't edit by hand. |
| `tools/db/make_scripts.mjs` | Rebuilds `all.txt` and `mac.txt` from `SP's/` (`node tools/db/make_scripts.mjs`). Writes files only. |
| `tools/db/query.mjs` | Quick table / query checks against the database in `.env`: `npm run db -- tables UNI`, `columns dbo.UNIStudents`, `procs Dashboard_MyUni`, or `"SELECT ..."`. Keep it to SELECTs. |

```
Browser ──> web/ (Vite, :5183)
              └─ /api/* ──> backend/MyUni.API (:5186)
                               └─ SQL Server SAC400: dbo.Dashboard_MyUni_*  (one procedure per portion)
```

## The procedures

They only read the ERP tables: they call no other procedure and change no table. Run `mac.txt` (DBeaver) or `all.txt` (SSMS) on the database to create or update all of them; check the `USE` line first.

| # | Procedure | Used by | Returns |
|---|---|---|---|
| 01 | `Dashboard_MyUni_CompanyList` | Company filter | Every active company |
| 02 | `Dashboard_MyUni_BranchList` | Campus filter | Active branches of the company |
| 03 | `Dashboard_MyUni_FacultyList` | Faculty filter | Active faculties |
| 04 | `Dashboard_MyUni_DepartmentList` | Department filter | Departments that belong to a faculty |
| 05 | `Dashboard_MyUni_DegreeList` | Degree filter | Active degree programs |
| 06 | `Dashboard_MyUni_SemesterList` | Semester strip | Semesters with their registered student count |
| 07 | `Dashboard_MyUni_StudentSummary` | Overview | One row of headline numbers |
| 08 | `Dashboard_MyUni_Registrations` | Students | Students per semester, degree, semester number, shift |
| 09 | `Dashboard_MyUni_Admissions` | Admissions | Seats announced and students admitted |
| 10 | `Dashboard_MyUni_Collections` | Collections | Money received per day, source, degree, challan type |
| 11 | `Dashboard_MyUni_Receivables` | Receivables | Billed, received, overdue per semester, degree, challan type |
| 12 | `Dashboard_MyUni_Defaulters` | Defaulters | One row per student with an overdue balance |
| 13 | `Dashboard_MyUni_Installments` | Installments | Installments per month, degree, plan status, state |
| 14 | `Dashboard_MyUni_Discounts` | Discounts | Discounts per type, category, fee type, degree, status |

The eight data procedures (07 to 14) take the same filters: `@CompanyId, @BranchId, @FacultyId, @DepartmentId, @DegreeId, @SemesterId, @StartDate, @EndDate` (NULL, or 0 for the numbers, means all).

## What is counted

The rules follow the ERP's own reports so the numbers match them.

- **Registered students** (`UNIStudents_Rp_GetRegisteredStudent`): active registrations of active students, in the semester they registered in (`RegisterInId`; the first semester when that is empty).
- **Billed**: net amount of main challans (`ParentIdGuid` empty) that are not expired or cancelled (`ChallanStatus` 3, 40).
- **Received**: net amount of paid challans (`ChallanStatus` 1, 62). **Balance** = Billed - Received.
- **Overdue / defaulter** (`UNIStudents_Rp_GetDefaulterData`): a main challan still open (not 1, 62, 3, 40, 63, 64) whose validity date (else due date) has passed, for a student whose balance is above zero.
- **Collected** (`UNIStudents_Rp_GetFeeCollection`): fee receipts of university students that are approved (`AEOFeeReceipts.FeeStatus` 19), plus bank receipt lines that are verified (`DocStatus` 35) on an approved or posted upload (`BankReceiptStatus` 2, 34).

## Running locally

API (copy `backend/MyUni.API/appsettings.example.json` to `appsettings.json` and fill in the connection string first; .NET 10 SDK):

```
cd backend
dotnet run --project MyUni.API --launch-profile http     # http://localhost:5186
```

Web:

```
cd web
npm install
npm run dev                                              # http://localhost:5183
```

`http://localhost:5183/?sample=1` shows made-up numbers (labelled as sample) to preview the layout when the database has little university data. It only works in `npm run dev`.

## Testing on a database without approved receipts

`Database:RequireApprovedReceipts` in `backend/MyUni.API/appsettings.json` (default `true`). Set it to `false` only against a test database: Collections then also counts fee receipts that are still pending (`FeeStatus` 4). Live must keep `true` so the numbers match the ERP's fee collection report.

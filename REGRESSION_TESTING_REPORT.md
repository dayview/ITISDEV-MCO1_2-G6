# GEMS Regression Testing Report

Scope: regression testing only. Goal was to confirm that the integration fixes captured in `INTEGRATION_TESTING_REPORT.md` (auth/session, admin protection, opportunity publication, student application/document/eligibility APIs) did not break functionality already verified in `SYSTEM_TESTING_REPORT.md` and `INTEGRATION_TESTING_REPORT.md`.

Method: server restarted clean (`node server/server.js`, port 3000) against the configured MongoDB database, then reseeded (`node server/scripts/seed.js` → `10 opportunities | 20 students | Applications: 55`). Retesting combined:
- `curl` against every API route (auth, opportunities, applications, documents, statistics, export) with student/admin/anonymous sessions.
- A headless-Chrome harness driven over the DevTools Protocol (Node's built-in `WebSocket`, no extra dependencies) to load every requested route and capture real console errors, uncaught exceptions, and failed network requests.
- The same harness driving live DOM interaction (typing into search boxes, clicking filters/tabs/checkboxes, submitting forms) to confirm wired behavior, not just page load.

Disposable records created during this pass (cleaned up via reseed after testing):
- `Regression Test Program`, `Regression Eligibility Test Program`, `Regression Ineligible CGPA Test Program`, `Regression Quick Apply UI Test` opportunities
- `regression_test_student@dlsu.edu.ph` student registration
- `regression_transcript.pdf` document reference and two submitted/nominated test applications
- Database was reseeded to the original 10/20/55 baseline after testing; no disposable data remains.

## 1. Page Loading

| Feature | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|
| `/login.html` | Loads with no console/network errors. | Loaded clean, no console errors, no failed requests. | Passed | |
| `/register.html` | Loads with no console/network errors. | Loaded clean, no console errors, no failed requests. | Passed | |
| `/dashboard.html` | Loads with no console/network errors. | Loaded clean under a student session. | Passed | |
| `/catalog.html` | Loads with no console/network errors. | Loaded clean under a student session. | Passed | |
| `/profile.html` | Loads with no console/network errors. | Loaded clean under a student session. | Passed | |
| `/documents.html` | Loads with no console/network errors. | Loaded clean under a student session. | Passed | |
| `/applications.html` | Loads with no console/network errors. | Loaded clean under a student session. | Passed | |
| `/admin/dashboard.html` | Loads with no console/network errors for an admin session. | Loaded clean. | Passed | |
| `/admin/programs.html` | Loads with no console/network errors for an admin session. | Loaded clean. | Passed | |
| `/admin/applicants.html` | Loads with no console/network errors for an admin session. | Loaded clean. | Passed | |
| `/admin/post-opportunity.html` | Loads with no console/network errors for an admin session. | Loaded clean. | Passed | |
| `/admin/admin-profile.html` | Loads with no console/network errors for an admin session. | Loaded clean. | Passed | |

No regressions across all 12 requested routes. All previously fixed page-loading behavior held.

## 2. Authentication

| Feature | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|
| Student login | Seeded student authenticates and receives `/dashboard.html` redirect. | `leon_pavino@dlsu.edu.ph` login returned `200` with `redirectTo: /dashboard.html`. | Passed | |
| Admin login | Seeded admin authenticates and receives `/admin/dashboard.html` redirect. | `admin@dlsu.edu.ph` login returned `200` with `redirectTo: /admin/dashboard.html`. | Passed | |
| Invalid login (wrong password) | Returns an error, no session created. | `401 Invalid credentials.` | Passed | |
| Invalid login (unknown email) | Returns an error, no session created. | `401 Invalid credentials.` | Passed | |
| Login page inline error | Wrong credentials show an inline message and keep the user on `/login.html`. | Browser test: submitting a bad password kept the user on `/login.html` and displayed "Invalid credentials." in `#login-message`. | Passed | |
| Registration | New student registers, is authenticated, and can log back in. | Browser-driven registration for a disposable student redirected away from `/register.html`; a follow-up `POST /api/auth/login` for that account returned `200` with the new user record. | Passed | |
| Admin route protection (anonymous) | Anonymous request to any `/admin/*` page redirects to login. | All 5 admin pages returned `302` when unauthenticated. | Passed | |
| Admin route protection (student session) | Student session is blocked from admin pages. | All 5 admin pages returned `403 Admin access required.` for a student session. | Passed | |
| Admin route protection (admin session) | Admin session can load all admin pages. | All 5 admin pages returned `200` for an admin session. | Passed | |

No regressions. Session-based auth and role gating introduced during integration testing are intact.

## 3. Admin Features

| Feature | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|
| Dashboard statistics cards | Stat cards populate from `/api/statistics`. | Cards updated via `updateStatistics()`; no console errors on load. | Passed | |
| Dashboard applicant queue | Table renders from `/api/applications`. | 55 seeded rows rendered on load. | Passed | |
| Dashboard search | Typing filters the visible rows by student/program name. | Search for an existing name ("Leon") reduced 55 rows to 3 matching rows; result count restored to 55 after clearing. | Passed | |
| Dashboard Incomplete filter | Filter icon activates the Incomplete pill and narrows the queue. | Filter icon click activated the Incomplete pill and returned 29 of 55 rows with incomplete documents. | Passed | |
| Dashboard Urgent sort | Urgent pill switches sort to nearest-deadline without changing the row count. | Subtitle updated to "Sorted by urgency · nearest deadline first"; queue count unaffected. | Passed | |
| Dashboard row selection | Checking a row shows the selection badge/count and reveals Export/Batch approve. | Selecting one row showed "1 selected", and both buttons became visible (`display: inline-block`). | Passed | |
| Dashboard notification bell | Bell shows non-blocking in-page feedback. | Click produced the "No new admin notifications..." status message without navigating away or blocking with `alert()`. | Passed | |
| Export list (CSV) | `/api/applications/export` returns a CSV of the current/selected applications. | Unfiltered export returned `200 text/csv` with 54 data rows + header; `ids`-filtered export returned exactly the requested row. | Passed | |
| Batch approve | `/api/applications/bulk-action` updates status for selected applications. | Bulk-approving 2 `submitted` applications to `nominated` returned `200` with both records updated and `statusHistory` appended. | Passed | |
| Programs page listing/search/filters | Programs load from `/api/admin/opportunities`; search and status filter narrow the list; bulk selection bar appears. | Search for "Tokyo" reduced 10 programs to 1; Published filter returned 8 of 10; selecting a row showed the bulk bar with "1" selected. | Passed | |
| Applicants page listing/search/filters | Applicants load from `/api/applications`; search and status filter narrow the list; bulk selection bar appears. | Search for "Leon" reduced 55 to 3; status-label filter narrowed correctly; row selection showed the bulk bar with "1" selected. | Passed | |
| Post Opportunity — save draft | Draft POSTs to `/api/opportunities` with `status: draft` and confirms via MongoDB. | Draft save returned "Draft saved successfully in MongoDB..." and produced a Mongo `_id`. | Passed | |
| Post Opportunity — publish | Publishing the same record PATCHes it to `status: published`. | Publish returned "Opportunity published successfully..." and the same `_id` was retained (update, not duplicate). | Passed | |
| Post Opportunity — visibility after publish | Published, non-expired opportunity appears in the admin list and the public catalog API. | New opportunity appeared in the admin opportunity list search and in `GET /api/opportunities` immediately after publish. | Passed | |

No regressions in any admin feature retested. All fixes from `SYSTEM_TESTING_REPORT.md` (row selection, filters, export, notification bell, batch approve) and `INTEGRATION_TESTING_REPORT.md` (admin session protection, opportunity publish flow) still hold.

## 4. Student Features

| Feature | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|
| Catalog listing | Published, non-expired opportunities load and render as cards. | 8–9 opportunities rendered depending on baseline state; no console errors. | Passed | |
| Catalog global search | Typing narrows visible cards by program/institution/country. | Searching "Tokyo" reduced 9 results to 1 matching result. | Passed | |
| Catalog sort | Sort-by dropdown reorders results (name, deadline asc/desc). | Switching sort options changed which card appeared first, consistent with the selected order. | Passed | |
| Catalog deadline range filter | Selecting a deadline window narrows results. | "Next 30 days" reduced 8 results to 2; "Any time" restored 8. | Passed | |
| Catalog page size | Page-size control updates pagination. | Pagination control re-rendered with the new page size without errors. | Passed | |
| Catalog view switcher (Card/Gallery/Calendar/Timeline) | Each tab renders its corresponding view without errors. | All four tabs activated correctly and rendered distinct DOM content with no console errors. | Passed | |
| **Catalog category/region filters** | Selecting a Category or Region narrows the visible catalog results. | Selecting "Exchange" in the Category dropdown left the result count unchanged (9 of 9); the `<select name="category">` and `<select name="region">` elements have no `change` listener anywhere in `catalog.js`, and the form has no visible submit control, so the selection is silently ignored. Confirmed via `git log`/`git show` that `attachEvents()` (where `pageSizeSelect`/`sortSelect`/`deadlineRangeSelect` get listeners but `category`/`region` do not) is unchanged by the system-testing (`dc9e125`) and integration-testing (`bdc1fe8`) commits — the gap predates both, introduced in the earlier `6d150cc` "sync opportunity workflow" commit. | **Needs Implementation** | Pre-existing gap, not a regression from the recent integration work, so left unfixed per the regression-only scope. `catalog.js` needs `change` listeners on `formFields.category`/`formFields.region` (mirroring the existing `deadlineRangeSelect` listener) to make these two filters functional. |
| Eligibility — missing document blocks apply | Applying without a required document is rejected with the specific missing item. | POST to `/api/applications` for a program requiring a Transcript returned `400` with `missing: ["Transcript"]` before any document was uploaded. | Passed | |
| Eligibility — CGPA blocks apply | Applying to a program requiring a higher CGPA than the student has is rejected. | Leon Pavino (CGPA 3.7) applying to a 3.9-CGPA-minimum test program returned `400` with `missing: ["Minimum CGPA of 3.9"]`. | Passed | |
| Apply flow — eligible student | Uploading the required document then applying succeeds and persists to MongoDB. | Document upload returned `201`; the follow-up application POST returned `201` with `status: submitted`, `documentsStatus: complete`. | Passed | |
| Apply flow — Quick Apply button (browser) | Clicking Quick Apply on the opportunity detail page submits via the real backend and updates the UI in place. | Browser click hit `/api/applications`, replaced the panel with the "Application submitted successfully!" alert, and disabled the button with "Application submitted" — no console errors. | Passed | |
| Applications page (`/applications.html`) | Newly submitted applications appear in the tracker list alongside prototype cards. | The freshly submitted test application rendered as the first `.quick-application-card` with the correct program name and `submitted` status chip. | Passed | |
| Documents page (`/documents.html`) load and upload handler | Page loads without errors; upload handler posts a document reference to the backend. | Page loaded clean; `/api/documents` POST/GET both function as documented. Static table still does not render uploaded documents dynamically, and view/download/delete remain prototype-only. | Needs Implementation | Unchanged from `INTEGRATION_TESTING_REPORT.md` — not a regression, still an open gap. |
| Profile page (`/profile.html`) | Form loads and client-side validation/save works. | Page loaded clean; form submit remains client-side only (no `/api/*` calls in `profile.js`). | Passed | Unchanged prototype behavior, consistent with `SYSTEM_TESTING_REPORT.md`. |
| Dashboard (`/dashboard.html`) backend wiring | Recommended/applicable opportunities pulled from the backend. | `dashboard.html`/its scripts still contain no `fetch()` calls; content remains static. | Needs Implementation | Unchanged from `INTEGRATION_TESTING_REPORT.md` — not a regression. |

## 5. UI Regression

| Feature | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|
| Student nav links (`dashboard.html`, `catalog.html`, `profile.html`, `documents.html`, `applications.html`) | All top-nav links point to registered routes. | Every `href` on every student page matches the `studentPages` allow-list in `server.js`. | Passed | |
| Admin nav links (`dashboard.html`, `programs.html`, `applicants.html`, `post-opportunity.html`, `admin-profile.html`) | All top-nav links point to registered admin routes. | Every relative `href` on every admin page matches the `adminPages` allow-list; "Switch to student view" correctly points at `/dashboard.html` / `../student/dashboard.html`. | Passed | |
| Console errors across all 12 pages | No console/runtime errors on load. | Zero console errors, zero uncaught exceptions across all 12 routes (unauthenticated and authenticated passes). | Passed | |
| Broken selectors | JS-referenced element IDs exist in the served HTML. | Cross-checked `admin-dashboard.js`, `admin-programs.js`, `admin-applicants.js`, `post-opportunity.js`, `catalog.js` against their HTML — all referenced IDs exist, except the category/region filter gap noted in Section 4. | Needs Implementation | Same finding as the catalog category/region filter above; not a new selector break. |
| Failed network requests | No 4xx/5xx resource loads other than the harmless favicon. | Only `favicon.ico` 404s were observed on every page; no CSS/JS/API failures. | Passed | |
| Layout/styling | No visible layout regressions from recent changes. | `git diff` for the integration/system-testing commits touched only `.js`/route files, not `.css`; page `bodyLength`/DOM structure loaded normally on every route. | Passed | Not verified pixel-by-pixel; see manual verification note below. |

## Regressions Found

None. Every behavior previously marked **Fixed** or **Passed** in `SYSTEM_TESTING_REPORT.md` and `INTEGRATION_TESTING_REPORT.md` was re-verified working after the integration changes, with a clean server restart and a fresh seed baseline.

## Regressions Fixed

None required — no regressions were introduced by the integration work.

## Pre-Existing Gap Found (Not a Regression, Left Unfixed)

- **Catalog Category/Region filters are inert.** `public/js/catalog.js`'s `attachEvents()` never attaches a `change` listener to the Category or Region `<select>` elements (only Sort, Deadline range, Page size, and the two search inputs are wired), and the filter form has no visible submit control. This predates both the system-testing and integration-testing commits (confirmed via `git show` on `dc9e125` and `bdc1fe8`, which never touch `attachEvents()`), so it is out of scope for this regression pass per the "only fix actual regressions" instruction. Recommended follow-up: add `change` listeners on `formFields.category`/`formFields.region` that reset `page` to `1` and call `renderResults()`, mirroring the existing `deadlineRangeSelect` handler.

## Remaining Manual Verification

- Pixel-level visual/styling regression pass (this report validated DOM structure, console cleanliness, and network health, not visual layout).
- Cross-browser check outside headless Chromium (Safari/Firefox rendering was not tested).
- Full file upload/download/delete workflow for documents remains prototype-only and needs manual UX sign-off once implemented.

## Remaining Implementation Gaps (Carried Over, Not New)

- `/dashboard.html` still has no backend wiring for recommended/applicable opportunities.
- `/documents.html` still renders a static table; uploaded backend document references are not dynamically listed, and view/download/delete are prototype-only.
- Catalog Category/Region filters are unwired (see above) — newly identified during this pass, not previously documented, but confirmed pre-existing rather than a regression.

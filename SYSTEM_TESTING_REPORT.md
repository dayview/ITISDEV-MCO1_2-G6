# GEMS System Testing Report

Scope: end-to-end system testing only for the requested user-facing routes. Tested with the app running at `http://localhost:3000` against the configured MongoDB connection, using headless Chrome plus focused manual-style interactions.

| Page/Feature | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|
| `/login.html` page load | Login page loads without browser/console errors. | Page loaded, nav rendered, no console/runtime errors. | Passed | Login UI is visible. |
| `/login.html` login action | Login validates credentials and routes by role. | Button is a plain link to `/dashboard.html`; no auth request, validation, or role routing. | Failed | Needs auth/session implementation or explicit prototype behavior. |
| `/register.html` page load | Registration page loads without browser/console errors. | Page loaded, nav rendered, no console/runtime errors. | Passed | Inputs/buttons are visible. |
| `/register.html` create account | Create Account submits/validates registration. | Button links directly to `/dashboard.html`; no registration request or validation. | Failed | Backend registration flow is not wired. |
| `/dashboard.html` | Student dashboard loads and nav links work. | Page loaded with student nav and cards; no console/runtime errors. | Passed | Topbar filter and notification buttons are visible but static. |
| `/catalog.html` | Catalog loads; search, filters, cards, view switches, pagination work. | Page loaded; catalog controls rendered results and no console/runtime errors were detected. | Passed | Browser pass verified controls exist and page renders with catalog data. |
| `/profile.html` | Profile loads; form fields and save/cancel controls work without console errors. | Page loaded, profile form rendered, no console/runtime errors. | Passed | Save behavior is client-side only. |
| `/documents.html` | Documents page loads; upload/view/download/delete controls perform actions. | Page loaded with no console errors, but document action buttons are static/prototype controls. | Failed | Needs file/action handlers or explicit disabled/prototype treatment. |
| `/applications.html` | Applications page loads; filter pills and application cards display correctly. | Page loaded with filters/cards and no console/runtime errors. | Passed | Quick-application localStorage script loaded successfully. |
| `/admin/dashboard.html` page load | Admin dashboard loads application data and stats from backend. | Originally served static rows without the real dashboard script; now loads backend rows/stats with no console errors. | Fixed | Updated served admin dashboard markup to use `admin-dashboard.js`. |
| `/admin/dashboard.html` search bar | Search filters applicant rows. | Search for `Mika` reduced visible rows from 2 to 1. | Fixed | Wired by using the expected `#search-input` selector. |
| `/admin/dashboard.html` filter icon | Filter icon performs a visible filter action. | Filter icon activates the Incomplete filter and keeps user on dashboard. | Fixed | Added `#admin-filter-toggle` handler. |
| `/admin/dashboard.html` Dashboard nav | Dashboard nav remains on admin dashboard. | Click stayed on `/admin/dashboard.html`. | Passed | Link works. |
| `/admin/dashboard.html` Programs nav | Programs nav routes to admin programs. | Click routed to `/admin/programs.html`. | Passed | Link works. |
| `/admin/dashboard.html` Applicants nav | Applicants nav routes to admin applicants. | Click routed to `/admin/applicants.html`. | Passed | Link works. |
| `/admin/dashboard.html` Post nav | Post nav routes to post opportunity page. | Click routed to `/admin/post-opportunity.html`. | Passed | Link works. |
| `/admin/dashboard.html` notification bell | Bell gives feedback without breaking the page. | Added non-blocking in-page status message; click stays on dashboard. | Fixed | Replaced blocking `alert()` with a temporary status notice. |
| `/admin/dashboard.html` OV profile button | OV avatar routes to admin profile. | Click routed to `/admin/admin-profile.html`. | Passed | Link works. |
| `/admin/dashboard.html` All/Urgent/Incomplete filters | Filters/sort update displayed queue. | All, Urgent, and Incomplete controls click successfully; Incomplete showed matching backend rows. | Fixed | Urgent now updates `currentSort` instead of sending a conflicting filter param. |
| `/admin/dashboard.html` switch to student view | Link routes to student dashboard. | Originally linked to missing relative path; now routes to `/dashboard.html`. | Fixed | Prevented broken `/student/dashboard.html` route. |
| `/admin/dashboard.html` row checkboxes | Selecting rows updates selected state. | Checkbox selection updated selected counter to `1`. | Fixed | Fixed ObjectId handling; removed broken `parseInt()` conversion. |
| `/admin/dashboard.html` selected counter | Counter appears only after selection and displays selected count. | Counter appeared with `1 selected`. | Fixed | Buttons reveal with selection. |
| `/admin/dashboard.html` Export list | Export downloads CSV for current/selected list. | Originally 404; now `/api/applications/export` returns `200 text/csv`. | Fixed | Added backend export route and selected ID support. |
| `/admin/dashboard.html` Batch approve | Button appears for selected rows and calls bulk action path. | Button appears after row selection. | Passed | Full approval mutation was not committed during final pass to avoid altering test data; API route exists and uses selected ObjectIds. |
| `/admin/programs.html` | Admin programs page loads; filters/actions render without console errors. | Page loaded, program rows/actions rendered, no console/runtime errors. | Passed | Admin nav links work from dashboard. |
| `/admin/applicants.html` | Applicants page loads; filters/actions render without console errors. | Page loaded, applicant rows/actions rendered, no console/runtime errors. | Passed | Admin nav links work from dashboard. |
| `/admin/post-opportunity.html` | Post opportunity page loads and admin-only form is available to admins. | Page loaded with form/actions and no console errors. | Passed | Page still relies on static `data-user-role`, not real session auth. |
| `/admin/admin-profile.html` | Admin profile page loads; form/actions render without console errors. | Page loaded, form/actions rendered, no console/runtime errors. | Passed | Settings/security buttons are mostly prototype UI. |
| Student/Admin route access | Student users should not access admin routes; admins should access admin routes. | Routes are directly accessible by URL without session/role enforcement. | Failed | This is a system-level auth gap and was not safely patched because login/session/seed data are not consistently implemented. |
| Broken routes and console errors | Requested routes should return pages without console/runtime failures. | All requested routes loaded with no browser console/runtime errors in final pass. | Passed | Fresh server was required after backend patch. |

## Fixes Applied

- Rewired served admin dashboard (`gems/views/admin/dashboard.html`) to use dynamic backend-backed controls instead of static sample rows.
- Fixed admin dashboard row selection for Mongo ObjectId strings.
- Fixed Admin Dashboard All/Urgent/Incomplete filter behavior.
- Added working filter icon and non-blocking notification bell feedback.
- Fixed Switch to student view route.
- Added `/api/applications/export` CSV endpoint with selected ID/filter support.

## Still Needs Manual Verification

- Real login/register/auth flow and role-based route protection.
- Full Batch approve mutation in a disposable test dataset.
- Student document upload/view/download/delete workflows.
- Static/prototype buttons on dashboard/documents/admin profile should be either wired to real actions or intentionally disabled/labeled as unavailable.

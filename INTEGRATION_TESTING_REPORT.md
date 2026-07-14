# GEMS Integration Testing Report

Scope: integration testing only. Verified frontend page routing/scripts, backend API routes, MongoDB persistence, and role/session behavior together. Tested with the app running at `http://localhost:3001` against the configured MongoDB database.

Seed baseline was refreshed after fixing seed opportunity publication:

```text
node server/scripts/seed.js
MongoDB connected.
Seeding...
Done: 10 opportunities | 20 students
Applications: 55
```

Disposable integration records were also created during testing:

- `Integration Test Eligible Program`
- `Integration Test Ineligible Program`
- `Integration Test Student`
- `integration_transcript.pdf` document reference
- one submitted application that was updated to `nominated`

| Flow | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|
| Backend Seed Data Integration - public opportunities API | Seeded published and non-expired opportunities are readable from `/api/opportunities`. | `/api/opportunities` returned 8 seed opportunities after excluding expired June 2026 deadlines. After test opportunity creation, student-facing count became 10. | Fixed | Seed opportunities originally defaulted to `draft`, so student-facing APIs could not show them. Updated seed data to mark opportunities `published`. |
| Backend Seed Data Integration - admin opportunities API | Admin can read all seeded opportunities from `/api/admin/opportunities`. | Admin session read 10 seeded opportunities, all published. After two test creates, admin total was 12. | Passed | Admin programs page loads `admin-programs.js`, which reads this API. |
| Backend Seed Data Integration - admin applications API | Seeded applications are readable and joined to students/opportunities. | Admin session read 55 seeded applications from `/api/applications`; rows included student name, student ID, program, institution, document status, and status. | Passed | Admin dashboard/applicants pages load scripts that consume this route. |
| Backend Seed Data Integration - statistics API | Admin dashboard stats reflect MongoDB application/opportunity state. | `/api/statistics` returned pending, nominated, accepted, live program, and country counts from MongoDB. | Passed | Protected by admin session after fix. |
| Login Integration - student | Student login validates credentials and redirects to `/dashboard.html`. | Seeded student `leon_pavino@dlsu.edu.ph` with `seed-password-placeholder` authenticated and returned `redirectTo: /dashboard.html`. | Fixed | Auth route was not mounted before; login page was a static link. |
| Login Integration - admin | Admin login validates credentials and redirects to `/admin/dashboard.html`. | `admin@dlsu.edu.ph` authenticated and returned `redirectTo: /admin/dashboard.html`. | Fixed | Supports seeded placeholder password and bcrypt-registered users. |
| Register Integration | Registration creates and authenticates a student through the session system. | Disposable student registration returned `201`, created a MongoDB user, and `/api/me` returned the authenticated session user. | Fixed | Register page now posts to `/api/auth/register`. |
| Invalid Login | Invalid credentials show an error instead of redirecting. | Bad admin password returned `401` with `Invalid credentials.` | Fixed | Login page has an inline alert target wired to the auth API. |
| Direct Admin URL Access | Non-admin users cannot access admin pages. | Unauthenticated `/admin/dashboard.html` returned `302` to `/login.html`; logged-in student got `403 Admin access required.` | Fixed | Admin pages now check session role before serving HTML. |
| Admin Opportunity Posting Flow | Admin creates an opportunity, MongoDB saves it, and admin/student lists show it when published and non-expired. | Admin POST created two published future opportunities. `/api/admin/opportunities` showed both; `/api/opportunities` included the published future eligible test opportunity. | Fixed | Admin create/update APIs now require admin session. |
| Student-facing opportunity visibility | Only published, non-expired opportunities appear to students. | Expired June 2026 seed opportunities were excluded; future published seed/test opportunities appeared. | Passed | Current test date: July 2, 2026. |
| Student Dashboard opportunity appearance | Applicable opportunities should appear in `/dashboard.html`. | Dashboard page remains mostly static and does not fetch `/api/opportunities`. | Needs Implementation | Catalog is backend-integrated; dashboard recommendations/deadlines still need API wiring. |
| Student Eligibility - missing document | Missing required documents block application submission with clear missing requirements. | Applying to `Integration Test Eligible Program` before uploading transcript returned `Application requirements are incomplete` and `missing: ["Transcript"]`. | Fixed | Backend checks required document references before save. |
| Student Eligibility - ineligible profile | Ineligible students cannot apply and missing profile requirements are shown. | Leon Pavino, CGPA 3.7, was blocked from the 3.9-CGPA test program with `missing: ["Minimum CGPA of 3.9"]`. | Fixed | Backend checks `eligibility.minCgpa`. |
| Student Apply - eligible | Eligible student with required documents can apply and application saves to MongoDB. | After saving a transcript reference, application POST succeeded with `status: submitted` and `documentsStatus: complete`. | Fixed | New `/api/applications` student route saves real Application records. |
| Admin Applicant Review - visibility | Submitted student applications appear in admin applicant/dashboard API data. | Admin search for `Integration Test Eligible` returned the submitted application joined to Leon Pavino and the test opportunity. | Passed | Admin dashboard and applicants pages both call `/api/applications`. |
| Admin Applicant Review - status update | Admin can update application status and student view reflects it. | Admin PATCH changed the test application to `nominated`; `/api/applications/my` for the student returned the same application with `status: nominated`. | Fixed | Student applications script now reads `/api/applications/my` when authenticated. |
| Document Workflow - upload reference | Student document upload saves file/reference correctly. | `/api/documents` POST saved a transcript document reference with filename, type, file path, and user ID; GET returned it. | Fixed | This is metadata/reference storage, not binary file storage. |
| Document Workflow - documents page | Uploaded documents should appear in `/documents.html`. | Page upload handler now saves a backend document reference after validation; the static vault table does not dynamically render backend documents yet. | Needs Implementation | API is present; frontend list rendering still needs to replace static table rows. |
| Document Workflow - required docs before submission | Required documents are checked before application submission. | Missing transcript blocked application; saved transcript allowed submission. | Fixed | Verified through student API and MongoDB save. |
| Document Workflow - file view/download/delete | Student should view/download/delete uploaded documents. | Existing buttons remain alert/prototype actions; no binary storage, download, or delete API exists. | Needs Implementation | Do not treat as passed until real file handling is implemented. |

## Fixes Applied

- Mounted `express-session` and `/api/auth` in `server/server.js`.
- Implemented student registration, login validation, session verification, and role-based redirects.
- Added admin page protection and protected admin APIs.
- Fixed admin-role checks to support existing roles: `OVPERI_Admin` and `System_Admin`.
- Updated seed opportunities to be `published` with explicit baseline eligibility.
- Added student document reference APIs: `GET/POST /api/documents`.
- Added student application APIs: `POST /api/applications` and `GET /api/applications/my`.
- Added backend eligibility/document checks before application save.
- Updated login/register pages to call backend auth APIs.
- Updated catalog/detail/application scripts to prefer backend data and fall back to prototype data only when needed.
- Updated documents upload handler to save a backend document reference.

## Still Needs Manual Verification

- Full browser interaction pass with visible redirects, inline errors, and page rendering after login.
- `/dashboard.html` backend integration for recommended/applicable opportunities.
- Dynamic rendering of uploaded backend documents in `/documents.html`.
- Real file upload storage, view, download, and delete workflow.
- Cleanup or reseed after disposable integration records if a pristine seeded database is required.

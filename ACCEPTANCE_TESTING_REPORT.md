# GEMS Acceptance Testing Report

**Scope:** Acceptance testing only — verifying that the implemented system satisfies the functional requirements and acceptance criteria implied by the project's User Stories for the seven modules listed in the test plan. System, integration, and regression testing were already completed (see `SYSTEM_TESTING_REPORT.md`, `INTEGRATION_TESTING_REPORT.md`, `REGRESSION_TESTING_REPORT.md`) and are not repeated here except where needed to confirm an acceptance criterion.

**Note on source of acceptance criteria:** No standalone `USER_STORIES.md` / acceptance-criteria document was found in the repository (checked working tree and full git history on all branches). The acceptance criteria below were therefore derived directly from the module/feature breakdown supplied in the test request, expressed as the criteria a reasonable GEMS user story for that feature would carry, and verified against the actual implementation. Where the repository's own tests/code comments confirm intended behavior, that intent is used as the criterion.

**Environment:** Branch `integration/admin-frontend-backend` (the branch actually reflecting the completed system/integration/regression work — testing was initially started against a stale `feature/database-system` checkout with no auth/session/API layer wired up; corrected before testing began). Server run locally at `http://localhost:3000` against the configured MongoDB Atlas database. Database reseeded (`node server/scripts/seed.js` → 10 opportunities / 20 students / 55 applications) before and after testing. Verification used `curl` against every API route under student/admin/anonymous sessions, direct MongoDB queries to confirm persisted side effects (e.g. audit log writes), and a headless-Chrome DevTools-Protocol harness (Node's built-in `WebSocket`, no added dependencies) to drive real browser interaction for frontend-only behavior.

---

# 1. User Management

## Registration

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want to register with my DLSU email so that only DLSU-affiliated users can create accounts. | Only `@dlsu.edu.ph` emails are accepted. | `POST /api/auth/register` with `test@gmail.com` returned `400 "Use a valid DLSU email address."` | Matches | Passed | |
| As a student, I want my password to meet a minimum strength so that my account is reasonably secure. | Passwords under 8 characters are rejected. | 5-character password returned `400 "Password must be at least 8 characters."` | Matches | Passed | Only a length check; no complexity requirement — acceptable for a minimum-strength criterion. |
| As a student, I want to be blocked from creating duplicate accounts. | Registering with an email or student ID already in use is rejected. | Second registration with the same email returned `409 "An account with this email or student ID already exists."` | Matches | Passed | |
| As a student, I want required fields validated before an account is created. | Missing email/password/name/studentId is rejected with a clear error. | Request with only `email` returned `400` listing the required fields. | Matches | Passed | |
| As a student, I want to be signed in immediately after registering. | Successful registration creates a session and returns a role-based redirect. | `201` response included `user` and `redirectTo: "/dashboard.html"`; follow-up `GET /api/me` returned the same session user. | Matches | Passed | |
| As a student, I want my account to default to the correct role. | New registrations are always created with role `Student`, never an admin role. | Seeded/created accounts via `/api/auth/register` always returned `role: "Student"`. | Matches | Passed | Role cannot be supplied by the client — `role: 'Student'` is hardcoded server-side. |

## Login

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a user, I want to log in with my email/password and be routed to the correct dashboard for my role. | Valid credentials authenticate and redirect students to `/dashboard.html` and admins to `/admin/dashboard.html`. | Student login returned `redirectTo: /dashboard.html`; admin login returned `redirectTo: /admin/dashboard.html`. | Matches | Passed | |
| As a user, I want invalid credentials rejected without leaking which field was wrong. | Wrong password or unknown email both return a generic `401 Invalid credentials.` | Both cases returned `401 {"error":"Invalid credentials."}`. | Matches | Passed | |
| As a user, I want my session to persist across requests so I don't have to re-authenticate on every page. | After login, `/api/me` and `/api/auth/verify` return the authenticated user. | Both endpoints returned the session user after login via cookie jar. | Matches | Passed | |
| As a user, I want to be able to log out and have my session invalidated. | `POST /api/auth/logout` destroys the session; subsequent `/api/me` calls are unauthorized. | Logout returned `200`; follow-up `/api/me` with the same cookie returned `401`. | Matches | Passed | |

## Password Reset

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a user who forgot my password, I want to request a reset link/code via email. | "Forgot password?" initiates a reset flow (request sent, token/email issued). | The link on `/login.html` is `<a href="#" class="field__forgot">Forgot password?</a>` — a dead anchor with no JS handler anywhere in `auth-pages.js`, and no `/api/auth/forgot-password` (or equivalent) route exists in `server/server.js` or `server/routes/auth.js`. | Clicking does nothing; no backend support exists. | **Needs Implementation** | Entirely unbuilt — no UI flow, no email delivery, no reset-token model/field on `User`. Not a bug to patch; this is a full feature gap requiring a reset-token mechanism and an email transport (see Notifications section — no email transport exists in the codebase at all). |
| As a user, I want to set a new password using my reset link/code. | Submitting a valid token + new password updates `passwordHashed` and invalidates the token. | No such endpoint exists. | N/A | **Needs Implementation** | Same gap as above. |

## Profile Management

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want to view my current profile information on `/profile.html`. | Profile page loads and reflects the logged-in user's actual data. | Page loads cleanly, but `profile.js` and `profile.html` contain zero `fetch()`/session calls — the form is pre-filled with static placeholder markup, not the logged-in user's real name/email/CGPA/etc. | Static prototype data shown regardless of who is logged in. | **Needs Implementation** | Confirmed via full-text search of `profile.js`/`profile.html` for `fetch(`/`session`/`api/me` — none found. |
| As a student, I want to update my profile (name, phone, etc.) and have it persist. | Submitting the profile form saves changes to the backend (`User` document updated). | Submit handler only runs client-side validation and shows a success toast (`toast.classList.add('show')`); no network request is made, so nothing is persisted. | Data is lost on refresh. | **Needs Implementation** | Same finding for the admin profile page (`gems/views/admin/admin-profile.html`) — no `fetch()`/`api/` calls anywhere in that file either. |

## Role & Permissions

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a system, I want new registrants to default to the least-privileged role. | All self-registered accounts are role `Student`. | Confirmed above under Registration. | Matches | Passed | |
| As a system, I want admin pages inaccessible to unauthenticated users. | Anonymous request to `/admin/*` redirects to login. | `GET /admin/dashboard.html` unauthenticated returned `302 → /login.html`. | Matches | Passed | |
| As a system, I want admin pages/APIs inaccessible to student accounts. | Student session hitting admin pages/APIs gets `403`. | `/admin/dashboard.html` → `403`; `/api/applications`, `/api/applications/bulk-action`, `POST /api/opportunities` all → `403 "Admin access required."` for a student session. | Matches | Passed | |
| As an admin, I want to access all admin pages/APIs when authenticated with an admin role. | Admin session (`OVPERI_Admin` or `System_Admin`) can load admin pages and call admin APIs. | Admin session got `200` on all 5 admin pages and all admin API routes tested. | Matches | Passed | |
| As a system, I want the two admin role tiers (`OVPERI_Admin`, `System_Admin`) to carry distinct permission scopes. | Actions restricted to `System_Admin` (e.g. user management) are blocked for `OVPERI_Admin`, or the two roles are documented as equivalent. | Both roles pass the identical `isAdminRole()` check everywhere in the codebase (`server.js`, `auth.js`) — there is no code path anywhere that distinguishes between them. `AuditLog.userRole` records which tier acted, but nothing gates on it. | No functional difference between the two admin roles exists anywhere in the app. | **Partially Implemented** | The two-tier role model exists in the `User` schema and is tracked in audit entries, but no differentiated capability is implemented or enforceable — every admin can do everything every other admin can do. Basic (binary) admin-vs-student RBAC is solid and fully passes. |

---

# 2. Opportunity Management

## Post an Opportunity

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As an admin, I want to create a new opportunity as a draft. | `POST /api/opportunities` with `status: draft` creates and persists the record. | Returned `201` with a Mongo `_id`; draft not visible on `GET /api/opportunities` (student-facing). | Matches | Passed | |
| As an admin, I want to publish a draft so students can see it. | `PATCH /api/opportunities/:id` with `status: published` updates the same record (not a duplicate) and makes it student-visible. | Same `_id` retained; opportunity appeared in `GET /api/opportunities` immediately after publish. | Matches | Passed | |
| As an admin, I want required fields validated when posting. | Missing a required field (e.g. `deadline`) is rejected with a clear error. | `POST` without `deadline` returned `400 "Opportunity validation failed: deadline: Path 'deadline' is required."` | Matches | Passed | |
| As an admin, I want only admins to be able to post/update opportunities. | Student/anonymous `POST`/`PATCH` is rejected. | Student → `403`; anonymous → `401`. | Matches | Passed | |
| As a student, I want to never see draft or expired opportunities in the catalog. | Only `published` + non-expired (`deadline >= now`) opportunities appear via `/api/opportunities`. | A freshly created `draft` opportunity and a freshly created `published`-but-`2020-01-01`-deadline opportunity both returned zero results when searched for. | Matches | Passed | |

## Opportunity Catalog

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want to browse and paginate all open opportunities. | Catalog loads, paginates, and supports page-size changes. | Confirmed via `REGRESSION_TESTING_REPORT.md` (unchanged since) and re-confirmed live: 8 published/non-expired opportunities returned. | Matches | Passed | |
| As a student, I want to search opportunities by keyword. | Typing narrows results by name/institution/country. | Confirmed unchanged from regression pass (search reduced 8→1 for "Tokyo"). | Matches | Passed | |
| As a student, I want to sort opportunities (name, deadline). | Sort dropdown reorders results. | Confirmed unchanged from regression pass. | Matches | Passed | |
| As a student, I want to filter opportunities by deadline window. | "Next 30/60/90 days" narrows results. | Confirmed unchanged from regression pass. | Matches | Passed | |
| As a student, I want to filter opportunities by category and region. | Selecting a Category or Region option narrows the visible results to matching opportunities. | Previously (per `REGRESSION_TESTING_REPORT.md`): selecting "Exchange" left results unchanged (9/9) — the `<select name="category">`/`<select name="region">` elements had no `change` listener in `catalog.js`. Root-caused and **fixed**: added `change` listeners mirroring the existing `deadlineRangeSelect` pattern. Also discovered and fixed a second, deeper bug: seed data used legacy category strings (`"Student Exchange"`, `"Short-Term Program"`, `"Research Program"`) that never matched the filter dropdown's canonical values (`"Exchange"`, `"Summer"`, `"Research"`, `"Internship"`, ...) used by the live admin "Post Opportunity" form, and seed opportunities never set a `region` at all — so even with a working listener, every category/region filter would have returned 0 results. Fixed `server/scripts/seed.js` to align seed `category`/`region` values with the schema the admin form and catalog filters actually use. | Browser-verified end-to-end post-fix (headless Chrome, real session): selecting Category = "Exchange" narrowed 8→6 results; resetting restored 8; Region = "Europe" → 1 result; Region = "Asia" → 6 results. | **Fixed** | Two independent bugs compounded here: a missing event listener (frontend) and stale seed data misaligned with the schema the rest of the app already used (data). Both fixed; not a redesign — the fix mirrors the existing working pattern for other filters and the existing canonical category/region vocabulary already used by the admin posting form. |
| As a student, I want multiple ways to view the catalog (Card/Gallery/Calendar/Timeline). | Each view tab renders without errors. | Confirmed unchanged from regression pass — all four tabs render distinct DOM content, no console errors. | Matches | Passed | |

---

# 3. Eligibility Management

## Automatic Eligibility Check

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want the system to automatically block my application if I don't meet the minimum CGPA requirement. | Applying to a program with `eligibility.minCgpa` above my CGPA is rejected with the specific missing requirement named. | Applied as Leon Pavino (CGPA 3.7) to a freshly created program requiring CGPA 3.9 → `400 {"missing":["Minimum CGPA of 3.9", "Transcript"]}` (before also uploading the transcript). | Matches | Passed | |
| As a student, I want the system to automatically block my application if a required document is missing. | Applying without an uploaded document matching a required type is rejected, naming the missing document. | Same request above named `"Transcript"` as missing in addition to the CGPA gap; retried after uploading a transcript reference — CGPA gap alone was reported. | Matches | Passed | |
| As a student, I want to be able to apply once all eligibility requirements are satisfied. | An eligible, fully-documented student's application succeeds and is persisted. | Applied to a second test program with `minCgpa: 0` and an uploaded transcript → `201`, `status: submitted`, `documentsStatus: complete`, persisted in MongoDB. | Matches | Passed | |
| As a student, I want to be blocked from applying twice to the same opportunity. | A second application to an opportunity I've already applied to is rejected. | Duplicate `POST /api/applications` for the same opportunity → `409 "You already applied to this opportunity."` | Matches | Passed | Enforced via the `{userId, opportunityId}` unique compound index on `Application`. |
| As a student, I want to be blocked from applying to a closed/expired opportunity. | Applying after the deadline or to a non-`published` opportunity is rejected. | `evaluateStudentEligibility`/route guard rejects with `400 "Opportunity is not open for applications."` when `status !== 'published'` or `deadline < now`. Confirmed via code path (same guard that blocks draft/expired opportunities from the catalog). | Matches | Passed | |

---

# 4. Application Management

## 1-Click Apply & Document Bundle

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want to apply to an opportunity in a single action once I'm eligible. | Clicking "Quick Apply" on the opportunity detail page submits the application via one backend call and updates the UI in place. | Confirmed unchanged from regression pass (browser-verified): click hit `/api/applications`, replaced the panel with a success message, disabled the button. Re-verified backend contract via `curl`: single `POST /api/applications` call with just `opportunityId` is sufficient to submit. | Matches | Passed | |
| As a student, I want my previously uploaded documents automatically bundled into a new application (no re-uploading per application). | Submitting an application attaches the student's already-uploaded `Document` references without requiring them to be re-specified per application. | `POST /api/applications` looks up `Document.find({userId})` server-side and attaches all matching documents to the new `Application.documents` array automatically; the client only sends `opportunityId`. | Matches | Passed | |

## Application Submission

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want my submitted application saved with an initial status and history entry. | New applications are created with `status: submitted` and a `statusHistory` entry. | Created application had `status: "submitted"` and `statusHistory: [{status: "submitted", changedAt, changedBy}]`. | Matches | Passed | |
| As a student, I want submission blocked with a clear reason if requirements aren't met. | See Eligibility Management above. | Same. | Matches | Passed | |

## Application Progress Tracker

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want to see the current status of all my applications. | `GET /api/applications/my` (used by `/applications.html`) returns each application's program, institution, deadline, status, and document status. | Returned all fields correctly for the test student, including the newly submitted application. | Matches | Passed | |
| As a student, I want to see status changes reflected after an admin reviews my application. | An admin status change (`under-review` → `nominated` → `accepted`, etc.) is visible to the student on next fetch. | Admin `PATCH /api/applications/:id/status` to `nominated`, then `GET /api/applications/my` for that student, showed `status: "nominated"`. | Matches | Passed | Confirms end-to-end admin→student status sync (also previously confirmed in `INTEGRATION_TESTING_REPORT.md`). |
| As a student, I want the applications list page to render my tracker cards without errors. | `/applications.html` loads and displays submitted applications alongside status chips. | Confirmed unchanged from regression pass. | Matches | Passed | |

## Document Management

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want to upload a document reference (transcript, recommendation, etc.) that the system can check against opportunity requirements. | `POST /api/documents` saves a document reference tied to my account with a normalized type. | Uploading `{type: "transcript", fileName: "..."}"` returned `201` with a normalized `type: "transcript"` and a generated `filePath`. | Matches | Passed | This is reference/metadata storage (filename + path), not binary file storage — consistent with the model design (`Document.filePath` is a string field, not a file upload target). |
| As a student, I want to see a list of documents I've uploaded. | `GET /api/documents` returns my uploaded document references. | Returned the uploaded transcript record for the test student. | Matches | Passed | |
| As a student, I want `/documents.html` to show the documents I've actually uploaded, not placeholder data. | The documents table renders from `GET /api/documents`, not static rows. | `documents.html` still renders a hardcoded static table (`grades_T32526.pdf`, `curriculum_audit.pdf`, `passport_biopage.jpg`, `recommendation_letter.pdf`) regardless of what's actually in the backend; only the *upload* action calls the real API (`POST /api/documents` confirmed present in the file). | Uploaded documents are saved correctly but never appear in the on-page list. | **Needs Implementation** | Unchanged from `INTEGRATION_TESTING_REPORT.md`/`REGRESSION_TESTING_REPORT.md` — a genuinely unfinished feature (the static table would need to be replaced with a render loop over `GET /api/documents`), not a small bug; left as-is per the "do not redesign" instruction, since wiring dynamic rendering is new frontend work, not a fix to broken logic. |
| As a student, I want to view/download/delete my uploaded documents. | Buttons on `/documents.html` perform real view/download/delete actions. | `confirmDelete()` and view/download buttons are prototype-only (no fetch, and no `DELETE`/download route exists on the backend at all — `grep` of `server.js` confirms zero `DELETE` routes). | Buttons are non-functional stubs. | **Needs Implementation** | No backend endpoint exists to build this against; this is unbuilt functionality, not a wiring bug. |

---

# 5. Notifications

## Email Notifications

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want to receive an email when my application status changes. | Status-change events trigger an outbound email. | No email transport exists anywhere in the codebase — `package.json` has no mail library (`nodemailer`, etc.), and no code sends any email. `grep -ri "nodemailer\|smtp\|mailer"` across `server/` returns nothing. | No emails are sent for any event. | **Needs Implementation** | Fully unbuilt — requires a mail transport, templates, and a trigger wired into the status-change/bulk-action handlers. |
| As an admin, I want to receive an email when a new application is submitted. | New submissions trigger an admin-facing email. | Same as above — no transport exists. | N/A | **Needs Implementation** | Same root gap. |

## Automated Deadline Reminders

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a student, I want to be automatically reminded as an opportunity's deadline approaches. | A scheduled job checks upcoming deadlines and notifies affected students. | No scheduler/cron library is present (`grep -ri "cron\|node-schedule"` across `server/` and `package.json` returns nothing), and no reminder logic exists. The only related concept is the admin dashboard's "urgent" (≤7-day) statistic, which is a manual-view aggregate, not a proactive notification. | No reminders are ever generated. | **Needs Implementation** | Fully unbuilt — requires a scheduled task (e.g. `node-cron`) plus the (also-unbuilt) email transport to deliver it. |

---

# 6. Admin Management

## Admin Review Dashboard

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As an admin, I want to see live statistics (pending, nominated, accepted, urgent, live programs, countries). | `/api/statistics` reflects current MongoDB state. | Returned accurate counts (`submitted`, `under-review`, `nominated`, `accepted`, `rejected`, `pending`, `urgent`, `livePrograms`, `countries`) matching seeded/test data. | Matches | Passed | |
| As an admin, I want to see, search, and filter the full applicant queue. | `/api/applications` supports `status`, `college`, `search`, `sort`, `documentsStatus`, `ids` query params. | All tested query combinations (status filter, search) returned correctly filtered/joined results (student + opportunity data). | Matches | Passed | |
| As an admin, I want to update a single application's status. | `PATCH /api/applications/:id/status` updates status and appends to `statusHistory`. | Confirmed (see Application Progress Tracker section). | Matches | Passed | |
| As an admin, I want the dashboard restricted to admin sessions only. | Anonymous/student access is blocked. | Confirmed (see Role & Permissions section). | Matches | Passed | |

## Batch Approval & Export

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As an admin, I want to update the status of multiple selected applications at once. | `POST /api/applications/bulk-action` with `{ids, status}` updates all matching records. | Bulk-updated 2 `submitted` applications to `under-review` → `200`, both records reflected the new status and an appended `statusHistory` entry. | Matches | Passed | |
| As an admin, I want bulk actions restricted to valid statuses and non-empty selections. | Invalid status or empty `ids` array is rejected. | Confirmed via route guard logic (`allowed.includes()` check, `ids.length` check) — matches the same validation already regression-tested. | Matches | Passed | |
| As an admin, I want to export the current/selected applicant list as CSV. | `/api/applications/export` (optionally filtered by `ids` or the same query filters as the list view) returns a well-formed CSV. | Unfiltered export returned a header + one row per application; `ids`-filtered export returned exactly the requested row(s), with proper CSV quoting for names containing commas/quotes. | Matches | Passed | |
| As an admin, I want batch/export actions restricted to admin sessions. | Student/anonymous requests are blocked. | Student session → `403 "Admin access required."` on `bulk-action`. | Matches | Passed | |

---

# 7. Security

## Two-Factor Authentication

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a user, I want to enable 2FA on my account for stronger login protection. | Clicking "Enable 2FA" on the admin/profile page starts a real TOTP/OTP enrollment flow (secret generation, QR/code verification), and `User.twoFactorEnabled` becomes `true` on success. | `User` schema has a `twoFactorEnabled: Boolean` field, and `admin-profile.html` has an "Enable 2FA" button — but the button has no click handler, no backend route exists for enrollment/verification (`grep` for `2fa\|totp\|otp\|speakeasy` across `server/` returns nothing beyond the schema field), and no TOTP library is a dependency. | Clicking the button does nothing; the field is dead/unused. | **Needs Implementation** | The data model has a placeholder field, but the entire flow (secret generation, verification code exchange, login-time challenge) is unbuilt. This is a real security-relevant gap, not a cosmetic one — flagging clearly rather than marking Passed. |
| As a user with 2FA enabled, I want to be challenged for a second factor at login. | Login for a `twoFactorEnabled: true` user requires a second-step code before a session is issued. | `POST /api/auth/login` in `server/routes/auth.js` never reads or checks `twoFactorEnabled` — login always completes in one step regardless of the flag. | No second factor is ever enforced. | **Needs Implementation** | Same root gap as above. |

## Audit Logging

| User Story | Acceptance Criterion | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|
| As a System Admin, I want administrative actions (opportunity create/update/publish/close, application status changes, bulk actions) recorded in an immutable audit trail with actor, role, target, and change detail. | Each of these mutations writes an `AuditLog` entry via `AuditLog.create`/`insertMany`. | **Before fix:** `AuditLog` model existed (fully built: append-only via `pre` hooks blocking updates/deletes, rich query statics, an `action` enum matching exactly `opportunity_created/updated/published/closed`, `application_status_changed`, `application_bulk_status_changed`) but was never imported or called from any live route in `server/server.js` — confirmed 0 `AuditLog` documents existed in MongoDB after exercising opportunity create/publish, single status change, and bulk status change. **After fix:** wired `AuditLog.create`/`insertMany` calls into all four live mutation routes (`POST /api/opportunities`, `PATCH /api/opportunities/:id` — using status transitions to pick `opportunity_published`/`opportunity_closed`/`opportunity_updated`, `PATCH /api/applications/:id/status`, `POST /api/applications/bulk-action`). Re-tested: exercising all four routes produced exactly 5 correctly-populated `AuditLog` documents (1 create, 1 status-transition publish, 1 single status change, 2 bulk status changes) with correct `userId`, `userRole`, `action`, `targetType`/`targetId`, and `changes`. | Now matches. | **Fixed** | This was a genuine integration bug, not an unfinished feature — the model's `action` enum is a 1:1 match to the mutation endpoints that already exist, strongly indicating the wiring was simply dropped when the routes were consolidated into `server.js`. An unused, schema-inconsistent duplicate router (`server/routes/applications.js`) also implements similar logging calls but is dead code (never mounted) — left untouched as out of scope (unrelated file, not on the live request path). |
| As a System Admin, I want to view/query the audit trail (by user, action, target, date range) through an admin screen. | An admin-facing audit log viewer exists, backed by `AuditLog.queryLogs`/`getRecentLogs`. | No such route or UI exists — `admin-profile.html` and all other admin pages have no audit-log section, and no `/api/audit` (or similar) route is registered in `server.js`. | No way to view the trail through the UI. | **Needs Implementation** | The model's rich static query methods (`queryLogs`, `getLogsByUser`, `getLogsByTarget`, `getRecentLogs`) exist and now have real data to query (post-fix), but nothing exposes them via an API route or admin page. This is new feature surface, not a wiring bug, so left unbuilt per scope. |

---

# Final Summary

**Total User Stories Tested:** 61 (across 18 feature groups spanning the 7 modules)
**Total Acceptance Criteria Evaluated:** 61

| Status | Count |
|---|---|
| Passed | 46 |
| Fixed (bug found and corrected during this pass) | 2 |
| Partially Implemented | 1 |
| Needs Implementation | 12 |

*("Fixed" criteria are counted separately from "Passed" because they failed acceptance at the start of this pass and were corrected as part of it — the catalog category/region filter, and audit logging for the four admin mutation routes.)*

## Fixes Applied During This Pass

1. **Catalog category/region filters (frontend + data)** — `public/js/catalog.js` had no `change` listener on the category/region `<select>` elements (pre-existing gap, flagged but left unfixed in `REGRESSION_TESTING_REPORT.md`). Added listeners mirroring the existing `deadlineRangeSelect` pattern. In verifying the fix, found a second, deeper bug: `server/scripts/seed.js` used legacy category strings and never set a `region` at all, so the filters would still have returned zero results even with a working listener — aligned seed data to the canonical category/region vocabulary already used by the live admin "Post Opportunity" form. Browser-verified end-to-end: Category="Exchange" narrows 8→6 results, Region="Europe"→1, Region="Asia"→6.
2. **Audit logging (backend)** — `server/server.js` never imported or called the fully-built `AuditLog` model from any of its four live mutation routes (opportunity create/update, application status change, application bulk status change), so zero audit trail existed despite the schema being purpose-built for exactly these actions. Wired `AuditLog.create`/`insertMany` into all four routes; verified 5 correct entries are now written when those routes are exercised.

No other code changes were made. Both fixes are minimal, mirror an existing working pattern elsewhere in the same file, and do not introduce new features, redesign existing flows, or touch unrelated code.

## Features Fully Meeting Business Requirements (Passed)

- **User registration, login, logout, session verification** — DLSU-email enforcement, password length validation, duplicate prevention, role defaulting, and session persistence all work correctly.
- **Role-based access control (binary admin/student)** — anonymous, student, and admin sessions are correctly gated on every tested admin page and admin API route.
- **Opportunity posting (draft/publish) and catalog browsing** — including search, sort, deadline-range filtering, pagination, multiple views, and (after this pass's fix) category/region filtering.
- **Automatic eligibility checking** — CGPA and required-document gating both correctly block ineligible applications with specific, actionable error messages.
- **1-Click Apply, document bundling, application submission, and the progress tracker** — a student's uploaded documents are automatically attached to new applications, submissions persist correctly with status history, duplicate applications are blocked, and status changes made by admins are correctly reflected back to students.
- **Admin review dashboard, batch approval, and CSV export** — statistics, filtered queue views, single and bulk status updates, and CSV export (unfiltered and ID-filtered) all function correctly and are properly access-controlled.
- **Audit logging of administrative mutations** — now correctly records every opportunity/application mutation with actor, role, target, and change detail (fixed this pass).

## Features Requiring Additional Implementation (Needs Implementation)

- **Password reset** — no UI flow, no backend route, no email delivery. Fully unbuilt.
- **Profile management (student and admin)** — both `/profile.html` and `/admin/admin-profile.html` are entirely static prototypes: they don't load the logged-in user's real data and don't persist edits anywhere.
- **Document view/download/delete, and dynamic document listing** — uploads correctly save a reference to the backend, but `/documents.html` still renders a hardcoded static table instead of the user's actual uploaded documents, and view/download/delete have no backing routes at all.
- **Email notifications** (status-change and new-submission emails) — no mail transport exists in the codebase at all.
- **Automated deadline reminders** — no scheduler exists; nothing proactively checks approaching deadlines.
- **Two-Factor Authentication** — a placeholder schema field and a static "Enable 2FA" button exist, but there is no enrollment flow, no verification, and no login-time second-factor challenge.
- **Audit log viewer** — the (now-functioning) audit trail has no admin-facing screen or API route to view/query it.
- **Differentiated OVPERI_Admin / System_Admin permissions** — the two-tier role exists in the schema but has no distinct enforced capabilities anywhere (Partially Implemented, not failed outright, since the underlying binary admin/student RBAC is solid).

## Ready for Production/Demo

The **core scholarship-application lifecycle is production/demo-ready**: registration → login → catalog browsing/filtering → eligibility-checked application → admin review → batch decisioning → export, including the audit trail for admin actions, all function correctly end-to-end against real MongoDB data with proper role-based access control at every layer.

**Not ready for production** (and should be scoped as follow-up work, not demoed as complete): password reset, profile editing, real document management (view/download/delete + dynamic listing), any form of email notification or deadline reminder, two-factor authentication, and an audit-log viewing UI. These are demo-safe to *skip* (rather than click through) but should not be presented as working.

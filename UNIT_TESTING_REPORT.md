# GEMS Unit Testing Report

Scope: unit testing only. Each test below exercises a single function, middleware, or mongoose schema in isolation, with all external dependencies (MongoDB, Express req/res, sessions, bcrypt, Date/time) mocked, stubbed, or passed in as parameters. No HTTP server was started and no real database connection was made. Integration/system/regression/acceptance behavior is out of scope and already covered by the other four reports.

## Test framework

- **Framework:** Jest 30 (`devDependencies` in `package.json`), the lightest framework that covers plain Node/CommonJS unit tests with built-in mocking (`jest.mock`), no project restructuring required.
- **Test file locations:** `server/__tests__/*.test.js` (10 files, 151 tests).
- **Run command:** `npm test` (aliases to `jest`, config lives inline in `package.json`).

## Refactor performed to make unit testing possible

Most business logic in this codebase lived as private, unexported closures inside `server/server.js`, which also calls `startServer()` at import time (connects to real MongoDB and opens a listening socket). That makes the logic untestable in isolation without hitting a live server. To satisfy the assignment's requirement to unit test "core business logic, validation methods, middleware, controllers, and helper functions," the following **pure, behavior-preserving extractions** were made (logic copy-moved verbatim, no behavior changes, `server.js` now calls into these modules instead of duplicating the code):

| New file | Extracted from | Contents |
|---|---|---|
| `server/lib/opportunities.js` | `server/server.js` | `oneLineArray`, `mapOpportunity`, `normalizeOpportunityInput`, `mapAdminOpportunity` |
| `server/lib/documents.js` | `server/server.js` | `normalizeDocumentType`, `defaultFilePath`, `hasDocumentType` |
| `server/lib/eligibility.js` | `server/server.js` | `evaluateStudentEligibility`, `isOpportunityOpenForApplication` |
| `server/lib/applications.js` | `server/server.js` | `applicationPipeline`, `buildApplicationPayload`, `appendStatusHistory`, `toApplicationsCsv`, `isValidStatus`, `APPLICATION_STATUSES` |
| `server/lib/statistics.js` | `server/server.js` | `computeStatisticsSummary`, `getUrgentCutoff`, `URGENT_WINDOW_MS` |
| `server/lib/audit.js` | `server/server.js` | `buildAuditEntry`, `ALLOWED_AUDIT_ACTIONS`, `determineOpportunityUpdateAction` |
| `server/lib/authValidation.js` | `server/routes/auth.js` | `roleHome`, `sanitizeUser`, `isDlsuEmail`, `isValidPassword`, `ADMIN_ROLES` |

`server/server.js` and `server/routes/auth.js` were left otherwise untouched (routes, middleware order, and response shapes are identical to before). Verified with `node -c` on every touched file after the refactor.

---

## 1. Authentication

| Module | Function | Test Case | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| Authentication | `isDlsuEmail` | Accepts a well-formed `@dlsu.edu.ph` email | `true` | `true` | Passed | |
| Authentication | `isDlsuEmail` | Rejects a non-DLSU email (`@gmail.com`) | `false` | `false` | Passed | |
| Authentication | `isDlsuEmail` | Is case-insensitive on the domain | `true` | `true` | Passed | |
| Authentication | `isDlsuEmail` | Rejects `undefined`/empty email | `false` | `false` | Passed | |
| Authentication | `isDlsuEmail` (DLSU restriction) | Rejects a lookalike domain (`notdlsu.edu.ph.evil.com`) | `false` | `false` | Passed | Confirms `endsWith` check can't be spoofed with a prefix match |
| Authentication | `isDlsuEmail` (DLSU restriction) | Rejects a suffix-appended lookalike (`dlsu.edu.ph.co`) | `false` | `false` | Passed | |
| Authentication | `isValidPassword` | Accepts an 8-character password (boundary) | `true` | `true` | Passed | |
| Authentication | `isValidPassword` | Rejects a 6-character password | `false` | `false` | Passed | |
| Authentication | `isValidPassword` | Rejects empty/`undefined` password | `false` | `false` | Passed | |
| Authentication | `roleHome` | Routes `OVPERI_Admin`/`System_Admin` to `/admin/dashboard.html` | `/admin/dashboard.html` | `/admin/dashboard.html` | Passed | |
| Authentication | `roleHome` | Routes `Student` to `/dashboard.html` | `/dashboard.html` | `/dashboard.html` | Passed | |
| Authentication | `sanitizeUser` | Strips `passwordHashed` and other server-only fields from the session payload | Object without `passwordHashed` | Object without `passwordHashed` | Passed | |
| Authentication | `POST /register` handler | Duplicate email/student ID: `User.create` rejects with Mongo code `11000` | `409` + `"An account with this email or student ID already exists."` | Same | Passed | `User` model mocked with `jest.mock`; DB never touched |
| Authentication | `POST /register` handler | Non-duplicate DB error is passed to `next(err)`, not swallowed as a 409 | `next` called once, no 409 | Same | Passed | |
| Authentication | `POST /register` handler | Successful registration starts a session and returns `201` | `201`, `redirectTo: '/dashboard.html'`, `req.session.user.role === 'Student'` | Same | Passed | |
| Authentication | `POST /register` handler | Rejects non-DLSU email before touching the DB | `400`, `User.create` not called | Same | Passed | |
| Authentication | `POST /register` handler | Rejects password `< 8` chars before touching the DB | `400`, `User.create` not called | Same | Passed | |
| Authentication | `POST /register` handler | Rejects missing required fields | `400`, `User.create` not called | Same | Passed | |
| Authentication | `POST /login` handler | Unknown email returns `401 Invalid credentials.` | `401` | `401` | Passed | `User.findOne` mocked to resolve `null` |
| Authentication | `POST /login` handler | Wrong password returns `401` | `401` | `401` | Passed | |
| Authentication | `POST /login` handler | Admin login redirects to `/admin/dashboard.html` | `redirectTo: '/admin/dashboard.html'` | Same | Passed | |
| Authentication | `requireAuth` middleware | No `req.session.user` → `401 Unauthorized` | `401`, `next` not called | Same | Passed | |
| Authentication | `requireAuth` middleware | No `req.session` object at all → `401` | `401` | `401` | Passed | |
| Authentication | `requireAuth` middleware | Valid session → attaches `req.user` and calls `next()` | `next()` called, `res.status` not called | Same | Passed | |
| Authentication | `requireAdmin` middleware | `role: 'OVPERI_Admin'` → allowed through | `next()` called | Originally `403` (bug) | **Fixed** | See Bug Fixes below |
| Authentication | `requireAdmin` middleware | `role: 'System_Admin'` → allowed through | `next()` called | Originally `403` (bug) | **Fixed** | See Bug Fixes below |
| Authentication | `requireAdmin` middleware | `role: 'Student'` → `403 Forbidden` | `403` | `403` | Passed | |
| Authentication | `requireAdmin` middleware | Missing `req.user` → `403 Forbidden` | `403` | `403` | Passed | |
| Authentication | `User` schema | Rejects an unknown `role` value | Validation error on `role` | Same | Passed | Enum: `Student`, `OVPERI_Admin`, `System_Admin` |
| Authentication | `User` schema | Defaults `role` to `Student` | `role === 'Student'` | Same | Passed | |
| Authentication | `User` schema | `email` and `studentId` are declared unique (duplicate detection at the DB layer) | `unique: true` on both paths | Same | Passed | Confirms the unique index that produces Mongo error code `11000` exercised above |

## 2. Opportunity Management

| Module | Function | Test Case | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| Opportunity Management | `Opportunity` schema | A fully-populated opportunity validates cleanly | No validation error | Same | Passed | |
| Opportunity Management | `Opportunity` schema | Required field validation: rejects missing `code`, `name`, `institution`, `category`, `deadline` | 5 field errors | Same | Passed | |
| Opportunity Management | `Opportunity` schema | Deadline validation: missing `deadline` is rejected | Error on `deadline` | Same | Passed | |
| Opportunity Management | `Opportunity` schema | Draft vs published: defaults `status` to `draft` | `status === 'draft'` | Same | Passed | |
| Opportunity Management | `Opportunity` schema | Draft vs published: accepts `published` and `closed` | No validation error | Same | Passed | |
| Opportunity Management | `Opportunity` schema | Draft vs published: rejects an unknown status (`archived`) | Error on `status` | Same | Passed | |
| Opportunity Management | `Opportunity` schema | Category validation: rejects a missing `category` | Error on `category` | Same | Passed | |
| Opportunity Management | `Opportunity` schema | Region validation: accepts a provided region string | No validation error, `region` preserved | Same | Passed | |
| Opportunity Management | `Opportunity` schema | Region validation: opportunity is still valid with `region` omitted (optional field) | No validation error | Same | Passed | |
| Opportunity Management | `oneLineArray` | Splits newline-separated text into a trimmed array | `['Benefit A','Benefit B','Benefit C']` | Same | Passed | |
| Opportunity Management | `oneLineArray` | Passes through an array, filtering falsy entries | `['A','B']` | Same | Passed | |
| Opportunity Management | `oneLineArray` | Returns `[]` for `null`/`undefined` | `[]` | `[]` | Passed | |
| Opportunity Management | `mapOpportunity` | Maps a plain object into the student-facing shape (id, programName, location, benefits array, `eligible: true`) | Mapped object matches | Same | Passed | |
| Opportunity Management | `mapOpportunity` | Falls back to `region` for `location` when `country` is absent | `location === 'Europe'` | Same | Passed | |
| Opportunity Management | `mapOpportunity` | Calls `.toObject()` when given a mongoose-document-like input | `toObject` invoked once | Same | Passed | |
| Opportunity Management | `normalizeOpportunityInput` | Accepts both canonical and admin-form field names (`programName`/`hostInstitution`) | Normalized to `name`/`institution` | Same | Passed | |
| Opportunity Management | `normalizeOpportunityInput` | Derives `country` from a `"City, Country"` location string | `country === 'Japan'` | Same | Passed | |
| Opportunity Management | `normalizeOpportunityInput` | Defaults `status` to `draft` when omitted | `status === 'draft'` | Same | Passed | |
| Opportunity Management | `normalizeOpportunityInput` | Preserves an explicit `published` status | `status === 'published'` | Same | Passed | |
| Opportunity Management | `normalizeOpportunityInput` | Joins an array of benefits into newline-separated text | `'A\nB'` | Same | Passed | |
| Opportunity Management | `normalizeOpportunityInput` | Generates a `GEMS-...` code from the name when none is provided | Matches `^GEMS-NUS-SUMMER-PROGRAM-\d+$` | Same | Passed | |
| Opportunity Management | `normalizeOpportunityInput` | Preserves an explicitly provided `code` | `code === 'GEMS-CUSTOM'` | Same | Passed | |
| Opportunity Management | `mapAdminOpportunity` | Labels `status` as `Draft`/`Published`/`Closed` for the admin UI | Matching label per input | Same | Passed | |
| Opportunity Management | `mapAdminOpportunity` | `periodState` is `Closed` once the deadline has passed | `'Closed'` | `'Closed'` | Passed | |
| Opportunity Management | `mapAdminOpportunity` | `periodState` is `Open` within 30 days of the deadline | `'Open'` | `'Open'` | Passed | |
| Opportunity Management | `mapAdminOpportunity` | `periodState` is `Upcoming` beyond 30 days | `'Upcoming'` | `'Upcoming'` | Passed | |
| Opportunity Management | `mapAdminOpportunity` | Includes the application count passed in | `applications === 7` | `7` | Passed | |

## 3. Eligibility Logic

| Module | Function | Test Case | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| Eligibility Logic | `evaluateStudentEligibility` | Minimum CGPA: blocks a student below the minimum | `eligible: false`, `missing` contains CGPA message | Same | Passed | |
| Eligibility Logic | `evaluateStudentEligibility` | Minimum CGPA: allows a student who meets it | `eligible: true` | `true` | Passed | |
| Eligibility Logic | `evaluateStudentEligibility` | Minimum CGPA: treats a missing student CGPA as `0` | `eligible: false` | `false` | Passed | |
| Eligibility Logic | `evaluateStudentEligibility` | Minimum CGPA: skipped entirely when the opportunity sets none | `eligible: true` | `true` | Passed | |
| Eligibility Logic | `evaluateStudentEligibility` | Blocks a graduating student when `nonGraduatingRequired` is true | `missing` contains graduating message | Same | Passed | |
| Eligibility Logic | `evaluateStudentEligibility` | Blocks a student without SDFO clearance when required | `missing` contains SDFO message | Same | Passed | |
| Eligibility Logic | `evaluateStudentEligibility` | Required document validation: flags every missing required document | `missing === ['Transcript','Passport']` | Same | Passed | |
| Eligibility Logic | `evaluateStudentEligibility` | Required document validation: passes when all required docs are present (matched via normalized type) | `eligible: true` | `true` | Passed | |
| Eligibility Logic | `evaluateStudentEligibility` | Required document validation: eligible when no documents are required at all | `eligible: true`, `missing: []` | Same | Passed | |
| Eligibility Logic | `isOpportunityOpenForApplication` | Published opportunity validation: rejects a `draft` opportunity | `false` | `false` | Passed | |
| Eligibility Logic | `isOpportunityOpenForApplication` | Published opportunity validation: rejects a `closed` opportunity | `false` | `false` | Passed | |
| Eligibility Logic | `isOpportunityOpenForApplication` | Published opportunity validation: accepts a published, non-expired opportunity | `true` | `true` | Passed | |
| Eligibility Logic | `isOpportunityOpenForApplication` | Rejects `null`/`undefined` opportunity (not found case) | `false` | `false` | Passed | |
| Eligibility Logic | `isOpportunityOpenForApplication` | Expired opportunity validation: rejects a published opportunity whose deadline already passed (fixed `now`, no real clock dependency) | `false` | `false` | Passed | `now` injected as a parameter instead of reading the system clock |
| Eligibility Logic | `isOpportunityOpenForApplication` | Expired opportunity validation: accepts a deadline exactly equal to `now` (boundary) | `true` | `true` | Passed | |
| Eligibility Logic | `Application` schema | Duplicate application detection: unique compound index on `userId + opportunityId` | Index exists with `unique: true` | Same | Passed | This index is what produces the `11000` error the `/api/applications` route maps to `409 You already applied` |

## 4. Application Logic

| Module | Function | Test Case | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| Application Logic | `isValidStatus` | Status transition/bulk validation: accepts all 5 known statuses (`submitted`, `under-review`, `nominated`, `accepted`, `rejected`) | `true` for each | Same | Passed | Parametrized, 5 cases |
| Application Logic | `isValidStatus` | Rejects an unknown status (`approved`, empty, `undefined`) | `false` | `false` | Passed | |
| Application Logic | `APPLICATION_STATUSES` | Exposes exactly the 5 known statuses in order | Matches fixed array | Same | Passed | |
| Application Logic | `buildApplicationPayload` (application creation helper) | Builds a `submitted` application with today's date and mapped document IDs | Payload matches exactly, `documentsStatus: 'complete'` | Same | Passed | `now` injected, no dependency on the system clock |
| Application Logic | `buildApplicationPayload` | Defaults to an empty document array when none are provided | `documents: []` | `[]` | Passed | |
| Application Logic | `appendStatusHistory` | Appends a new entry without mutating the original array | New array length 2, original untouched | Same | Passed | |
| Application Logic | `appendStatusHistory` | Starts a fresh history array when none exists yet | 1-item array | Same | Passed | |
| Application Logic | `toApplicationsCsv` (CSV export formatter) | Header row + one data row per record, fields in the documented column order | Exact CSV string match | Same | Passed | |
| Application Logic | `toApplicationsCsv` | Escapes embedded double quotes in text fields (CSV injection/formatting safety) | `""JD""` style escaping present | Same | Passed | |
| Application Logic | `toApplicationsCsv` | Empty result set produces header-only output | 1 line | 1 line | Passed | |
| Application Logic | `toApplicationsCsv` | Missing optional fields fall back to empty strings, not `undefined`/`null` | No literal `undefined` in output | Same | Passed | |
| Application Logic | `applicationPipeline` | Adds a `$match` stage filtering by `status` when provided | `$match.status === 'nominated'` | Same | Passed | |
| Application Logic | `applicationPipeline` | Omits `$match` entirely when no filters are given | No `$match` stage | None | Passed | |
| Application Logic | `applicationPipeline` | Falls back to the `recency` sort for an unrecognized sort key | `{createdAt:-1, submittedDate:-1}` | Same | Passed | |
| Application Logic | `Application` schema | A valid application (userId, opportunityId, submittedDate) passes validation | No error | Same | Passed | |
| Application Logic | `Application` schema | Required field validation: rejects missing `userId`, `opportunityId`, `submittedDate` | 3 field errors | Same | Passed | |
| Application Logic | `Application` schema | Status transition validation: defaults to `submitted`, rejects an unknown value (`approved`) | Default correct, error on invalid | Same | Passed | |

## 5. Document Logic

| Module | Function | Test Case | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| Document Logic | `normalizeDocumentType` | Free-text labels normalize to the correct canonical type (transcript/grade, recommendation/reference, passport, EAF/application form, curriculum, ID → `validId`, unmatched → `other`) | Canonical type per case | Same | Passed | Parametrized, 10 cases |
| Document Logic | `normalizeDocumentType` | Case-insensitive matching | `'transcript'` | `'transcript'` | Passed | |
| Document Logic | `normalizeDocumentType` | Missing/empty input classified as `other` | `'other'` | `'other'` | Passed | |
| Document Logic | `defaultFilePath` (file reference generation) | Builds `uploads/{userId}/{fileName}` | Exact path string | Same | Passed | |
| Document Logic | `hasDocumentType` (required document lookup) | Finds a matching document by normalized type | `true` | `true` | Passed | |
| Document Logic | `hasDocumentType` | Returns `false` when the required type is missing | `false` | `false` | Passed | |
| Document Logic | `hasDocumentType` | Returns `false` for an empty document list | `false` | `false` | Passed | |
| Document Logic | `Document` schema | A valid document (userId, type, filePath) passes validation | No error | Same | Passed | |
| Document Logic | `Document` schema | Rejects an unknown document `type` (`diploma`) | Error on `type` | Same | Passed | |
| Document Logic | `Document` schema | Required field validation: rejects missing `userId`, `type`, `filePath` | 3 field errors | Same | Passed | |

## 6. Statistics Logic

| Module | Function | Test Case | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| Statistics Logic | `computeStatisticsSummary` | Pending count = submitted + under-review | `7` | `7` | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Submitted count reflects the aggregation | `4` | `4` | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Under Review count reflects the aggregation | `3` | `3` | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Nominated count reflects the aggregation | `2` | `2` | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Accepted count reflects the aggregation | `5` | `5` | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Rejected count reflects the aggregation | `1` | `1` | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Unknown status buckets from the aggregation (e.g. `archived`) are ignored, not injected | `undefined` for unknown key | Same | Passed | |
| Statistics Logic | `computeStatisticsSummary` | All counts default to `0` when the aggregation returns nothing | All-zero object | Same | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Live opportunity count passes through unchanged | `12` | `12` | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Urgent deadline count passes through | `6` | `6` | Passed | |
| Statistics Logic | `computeStatisticsSummary` | Urgent deadline count defaults to `0` when not provided | `0` | `0` | Passed | |
| Statistics Logic | `getUrgentCutoff` | Returns a date exactly 7 days after the given `now` | `+7d` | `+7d` | Passed | `now` injected, no real clock dependency |
| Statistics Logic | `computeStatisticsSummary` | Counts only truthy country values (falsy/`null` filtered) | `2` | `2` | Passed | |

## 7. Audit Logging

| Module | Function | Test Case | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| Audit Logging | `buildAuditEntry` (audit log creation) | Builds an entry carrying every field provided (user, role, action, target, changes, ip) | Entry matches input exactly | Same | Passed | |
| Audit Logging | `buildAuditEntry` | Defaults `changes` to `[]` when omitted | `changes: []` | `[]` | Passed | |
| Audit Logging | `buildAuditEntry` (allowed action validation) | Accepts every one of the 7 schema-allowed actions | No throw | Same | Passed | Parametrized, 7 cases |
| Audit Logging | `buildAuditEntry` | Throws `Invalid audit action: ...` for an action outside the allowed list | Throws with message | Same | Passed | |
| Audit Logging | `buildAuditEntry` (target mapping) | Records `targetType`/`targetId` exactly as supplied | Matches input | Same | Passed | |
| Audit Logging | `buildAuditEntry` (user role recording) | Records the acting user's role on the entry | `userRole === 'System_Admin'` | Same | Passed | |
| Audit Logging | `determineOpportunityUpdateAction` | Classifies draft→published as `opportunity_published` | Correct action | Same | Passed | |
| Audit Logging | `determineOpportunityUpdateAction` | Classifies published→closed as `opportunity_closed` | Correct action | Same | Passed | |
| Audit Logging | `determineOpportunityUpdateAction` | Same-status edit classified as plain `opportunity_updated` | Correct action | Same | Passed | |
| Audit Logging | `determineOpportunityUpdateAction` | No known previous status classified as `opportunity_updated` | Correct action | Same | Passed | |
| Audit Logging | `AuditLog` schema | A valid audit entry passes validation | No error | Same | Passed | |
| Audit Logging | `AuditLog` schema | Allowed action validation: rejects an action outside the schema enum | Error on `action` | Same | Passed | |
| Audit Logging | `AuditLog` schema | User role recording: rejects a non-admin `userRole` (e.g. `Student`) | Error on `userRole` | Same | Passed | |
| Audit Logging | `AuditLog` schema | Target mapping: rejects a `targetType` outside `Opportunity`/`Application` | Error on `targetType` | Same | Passed | |
| Audit Logging | `AuditLog` schema | Append-only behavior: `updateOne` is blocked | Rejects with append-only error | Same | Passed | Verified without a live DB connection — the `pre` hook fires before the query reaches the driver |
| Audit Logging | `AuditLog` schema | Append-only behavior: `deleteOne` is blocked | Rejects with append-only error | Same | Passed | |
| Audit Logging | `AuditLog` schema | Append-only behavior: `findOneAndUpdate` is blocked | Rejects with append-only error | Same | Passed | |

---

## Bug Fixes

### Fixed: `requireAdmin` middleware checked for a role that doesn't exist

**File:** `server/middleware/auth.js`

The middleware compared `req.user.role !== 'admin'`, but the `User` schema (`server/models/User.js`) only ever assigns `'Student'`, `'OVPERI_Admin'`, or `'System_Admin'` — the literal string `'admin'` is never a valid role (confirmed against `roleHome()` and `isAdminRole()`, which both check for `'OVPERI_Admin'`/`'System_Admin'`). Any route wired through this middleware would reject every real admin with a `403`.

- **Failure scenario:** An admin user (`role: 'OVPERI_Admin'`) hits a route protected by `requireAuth, requireAdmin` → gets `403 Forbidden. Admin access required.` instead of being let through.
- **Fix:** Replaced the single-string comparison with a check against `ADMIN_ROLES = ['OVPERI_Admin', 'System_Admin']`, matching the same convention already used elsewhere in the codebase (`server/server.js`'s `isAdminRole`, `server/routes/auth.js`'s `roleHome`).
- **Blast radius at discovery time:** Low — `server/routes/applications.js` and `server/routes/statistics.js` are the only files that import this middleware, and neither is currently mounted in `server/server.js` (confirmed via `grep -rn "routes/applications\|routes/statistics" server/`), so the live app was not affected. The bug was latent, but would have broken those routes the moment either file was wired up. Fixing it now removes a trap for whoever re-enables them.

No other genuine logic bugs were found — every other unit test passed against the existing implementation on the first run.

---

## Final Summary

- **Total modules tested:** 7 (Authentication, Opportunity Management, Eligibility Logic, Application Logic, Document Logic, Statistics Logic, Audit Logging)
- **Total unit tests executed:** 151
- **Passed:** 149
- **Failed:** 0
- **Fixed:** 2 (`requireAdmin` allowing `OVPERI_Admin` / `System_Admin`, both under the same root-cause bug)

### Most reliable modules

- **Audit Logging** and **Document Logic** — both fully deterministic pure functions plus schema-level append-only enforcement; 100% pass rate with no edge cases requiring special handling.
- **Opportunity Management** and **Statistics Logic** — extracted mapping/formatting functions with no hidden state; behavior fully pinned down by input/output pairs.

### Logic bugs discovered

1. `requireAdmin` middleware (`server/middleware/auth.js`) checked for role `'admin'` instead of the real roles `'OVPERI_Admin'`/`'System_Admin'`.

### Logic bugs fixed

1. Same as above — `requireAdmin` now checks membership in `ADMIN_ROLES = ['OVPERI_Admin', 'System_Admin']`.

### Remaining technical debt

- `server/routes/applications.js` and `server/routes/statistics.js` are dead code — not required anywhere by `server/server.js` (the live app reimplements equivalent `/api/applications` and `/api/statistics` endpoints directly in `server.js`). They still compile and their middleware bug is now fixed, but they represent duplicate, unmounted logic that should be deleted or consolidated in a future cleanup.
- `PATCH /api/applications/:id/status` and `POST /api/applications/bulk-action` push `{ status, changedAt }` into `statusHistory` without a `changedBy` field, unlike the initial `submitted` entry created in `buildApplicationPayload`. This is a pre-existing inconsistency, not a regression from this testing pass — flagged here rather than fixed, since it doesn't cause incorrect behavior today (schema allows an optional field) and fixing it would need a product decision about backfilling old records.
- No explicit business rule exists for "valid status transitions" (e.g. blocking `accepted → submitted`); any value in `APPLICATION_STATUSES` is accepted from any current status. Unit tests reflect the code as written; if this needs tightening, `isValidStatus` in `server/lib/applications.js` is the place to add transition-aware validation.

### Unit test coverage achieved

Coverage was measured with `npx jest --coverage` scoped to the files exercised by these unit tests (`server/lib/**`, `server/middleware/auth.js`, `server/routes/auth.js`):

| File | % Statements | % Branch | % Functions | % Lines |
|---|---|---|---|---|
| `lib/applications.js` | 79.5% | 75.5% | 77.8% | 80.6% |
| `lib/audit.js` | 100% | 100% | 100% | 100% |
| `lib/authValidation.js` | 100% | 100% | 100% | 100% |
| `lib/documents.js` | 100% | 100% | 100% | 100% |
| `lib/eligibility.js` | 100% | 96.2% | 100% | 100% |
| `lib/opportunities.js` | 100% | 87.7% | 100% | 100% |
| `lib/statistics.js` | 100% | 55.6% | 100% | 100% |
| `middleware/auth.js` | 100% | 100% | 100% | 100% |
| `routes/auth.js` | 82.2% | 81.3% | 40% | 84.1% |
| **Overall (unit-tested surface)** | **91.9%** | **86.1%** | **86.8%** | **92.1%** |

The uncovered lines are almost entirely the `applicationPipeline` aggregation branches for `college`/`search` filters and a couple of `routes/auth.js` handlers (`logout`, `verify`) that are trivial pass-throughs already covered end-to-end by integration testing. Mongoose model files (`Opportunity`, `Application`, `Document`, `User`, `AuditLog`) are exercised through `validateSync()`/index inspection rather than Istanbul line coverage, so they aren't reflected in the table above, but every `required`, `enum`, `unique`, and `pre`-hook constraint on each schema has at least one dedicated test.

# University Management System — Project Requirements

> **Status:** Implementation complete against this checklist. This document
> was originally a code-review-based gap analysis; it's now a record of
> what was built, kept for reference. See [`README.md`](./README.md) for
> setup, environment variables, the endpoint summary, and the full Postman
> collection ([`postman_collection.json`](./postman_collection.json)).

## 1. Project Overview

Backend for university administration and academic operations across three roles:

- **ADMIN** — manage users, academic resources, payments, notices, and oversight.
- **FACULTY** — manage assigned course activity and student results.
- **STUDENT** — manage profile, enrollment, results, and payments.

**Stack:** Node.js, TypeScript, Express 5, PostgreSQL, Prisma ORM 7 with
`@prisma/adapter-pg`, `tsx`, Redis, JWT + Google OAuth2, bKash (tokenized
checkout), Cloudinary, Zod, `http-status`, Biome, and Node's built-in test
runner.

## 2. Mandatory Requirements Checklist

| Requirement | Status |
|---|---|
| API Documentation (Postman/Swagger) | [x] `postman_collection.json` — 68 requests across 14 resource folders + a Cleanup folder, example bodies, chained via collection variables, verified with `newman run` against a live server |
| Consistent JSON response format | [x] Every response is `{success, statusCode, message, data, meta?}` or `{success, statusCode, message, errors?}` — see `utils/sendResponse.ts` and `middleware/globalErrorHandler.ts` |
| Minimum 20 meaningful git commits | [x] 20 commits, each a real, independently-described change (several document real bugs found and fixed while building/testing) |
| Minimum 20 meaningful, documented API endpoints | [x] 68 endpoints across auth/users/departments/faculties/students/courses/semesters/course-offerings/enrollments/results/notices/payments/admin |
| API versioning (`/api/v1/...`) | [x] `src/routes/index.ts` mounted at `/api/v1` in `app.ts` |
| Server-side Zod validation with field errors | [x] `middleware/validateRequest.ts`; every mutating endpoint has a `<feature>.validation.ts` schema; errors surface as `errors: [{path, message}]` |
| Email/password + Google OAuth2 Bearer authentication | [x] `POST /auth/register`, `/login`, `/refresh-token`, `/logout`, `/google` (idToken Bearer, links-or-404 against an existing account) |
| Strict 3-role RBAC middleware | [x] `middleware/checkAuth.ts` `auth(...roles)`; re-checks DB role/isActive/deletedAt on every request, not just at token-issue time |
| Working demo admin credentials | [x] `npm run seed` (idempotent); verified all 4 seeded accounts log in successfully via the real API during this build |
| Real payment integration and verified callbacks | [x] bKash tokenized checkout: `POST /payments/initiate`, `GET /payments/callback` (execute + a separate query call to cross-check before marking PAID); amount is server-set per semester, never client-supplied. **Not exercised against a live bKash sandbox session** — see README "Known limitations" |
| PostgreSQL + Prisma relationships, constraints, indexes, transactions | [x] Enrollment seat-limit and payment-callback finalization are concurrency-safe (Serializable transaction + retry, and a conditional `updateMany` guard, respectively) — both covered by an integration test |
| Password hashing, secret protection, protected private routes | [x] bcrypt, JWT secrets validated at boot (fails fast if missing), refresh tokens stored as sha256 hashes, `.env` gitignored |
| `express-rate-limit` on sensitive/public routes | [x] `authLimiter` (auth), `accountCreationLimiter` (admin/faculty/student creation), `paymentCallbackLimiter` (bKash callback), `generalLimiter` (baseline on all of `/api/v1`) |
| Helmet and properly configured CORS | [x] `helmet()`; CORS origin allowlist from `CORS_ALLOWED_ORIGINS`, not `origin: true` |
| Soft deletes using `deletedAt` on core resources | [x] Every core model has `deletedAt`; every delete endpoint sets it instead of removing the row (audited — the only real `.delete()` left is refresh-token rotation, which should hard-delete) |
| Audit logs/activity tracking | [x] `AuditLog` model + `utils/auditLog.ts`, written by every mutating service call; `GET /admin/audit-logs` (paginated, filterable) |
| Pagination on a list endpoint | [x] Every list endpoint (`utils/paginationHelper.ts`) |
| Filtering/sorting on a list endpoint | [x] Resource-specific filters (department/semester/status/role/etc.) + `sortBy`/`sortOrder` on every list endpoint |
| Search (`q=keyword`) where relevant | [x] `searchTerm` query param on every list endpoint that has a text field worth searching (departments, faculties, students, courses, semesters, notices, users) |
| Deployment to a live URL | [ ] Not deployed from this environment — `Dockerfile`, `docker-compose.yml`, `render.yaml`, and full deployment steps are in the README; deploying is the user's own action (external infrastructure, needs their account/credentials) |

## 3. Database Schema Reference

Multi-file schema under `prisma/schema/`, no root `schema.prisma`. All 12
core models below have `deletedAt DateTime?` (indexed) — omitted from the
table for brevity, noted once here instead.

| Model | Key fields | Relations / constraints |
|---|---|---|
| `User` | `id`, unique `email`, optional `password`/`googleId`, `role`, `isActive` | Admin/Faculty/Student profiles, refresh tokens, notices; role index |
| `RefreshToken` | `id`, unique `token` (sha256 hash), `userId`, `expiresAt` | User cascade; user index. Not soft-deleted — rotation/logout hard-delete it on purpose |
| `Admin` | `id`, unique `userId`, `name`, `phone` | One-to-one User cascade |
| `Department` | `id`, unique `name`/`code` | Faculties, courses, students |
| `Faculty` | `id`, unique `userId`/`facultyId`, `name`, `designation`, `phone`, `departmentId` | User, Department; course offerings |
| `Student` | `id`, unique `userId`/`studentId`, `name`, `phone`, DOB, department/admission-semester IDs | User, Department, Semester; enrollments, payments |
| `Course` | `id`, unique `courseCode`, `title`, `credits`, `departmentId` | Department; offerings |
| `Semester` | `id`, `year`, unique `code`, dates, `status`, **`feeAmount`** | Offerings, payments, admitted students. `feeAmount` is the authoritative tuition fee `payments.initiate` reads — never trusted from the client |
| `CourseOffering` | `id`, `maxSeats`, course/faculty/semester IDs | Unique `(courseId, semesterId, facultyId)`; enrollments |
| `Enrollment` | `id`, `status`, student/offering IDs | Unique `(studentId, courseOfferingId)`; optional Result |
| `Result` | `id`, `grade`, `gradePoint`, unique `enrollmentId` | One-to-one Enrollment cascade |
| `Payment` | `id`, `amount`, **`gatewayPaymentId`** (unique, bKash paymentID), **`transactionId`** (nullable unique, bKash trxID once paid), `status`, `paymentMethod`, **`failureReason`** | Student/Semester |
| `Notice` | `id`, title/content, `audience`, `postedByUserId` | User author |
| `AuditLog` | `id`, `action`, `entityType`, `entityId?`, `performedBy{UserId,Email,Role}?`, `description?`, `metadata?` (Json), `ipAddress?`, `createdAt` | No relations — plain fields, so a log entry outlives the user it describes |

Enums: `Role`, `SemesterStatus`, `EnrollmentStatus`, `PaymentStatus`,
`NoticeAudience`. Migrations are current and applied to the live database;
`npm run seed` is idempotent.

**Known limitation:** Postgres unique constraints aren't aware of
`deletedAt` (Prisma's schema language can't express a partial index without
raw SQL), so a soft-deleted account's email (or a course/semester code)
can't be reused by a new record. Documented in the README rather than fixed
with a raw-SQL migration, given the scope of this build.

## 4. Full API Endpoint Inventory

68 endpoints, all implemented, RBAC-scoped, and covered in the Postman
collection. Full detail (bodies, query params, exact role rules) lives
there and in the README's endpoint summary table — this is the map:

| Resource | Endpoints |
|---|---|
| `auth` | `POST /register`, `/login`, `/refresh-token`, `/logout`, `/google` |
| `users` | `GET/PATCH /me`, `PATCH /profile-image`, `GET/POST /`, `GET /:id`, `PATCH /:id/role`, `PATCH /:id/status`, `DELETE /:id` |
| `departments`, `courses`, `semesters` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| `faculties`, `students` | same CRUD shape as above |
| `course-offerings` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/assign-faculty`, `DELETE /:id` |
| `enrollments` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id/status` |
| `results` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id` |
| `notices` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| `payments` | `POST /initiate`, `GET /callback`, `GET /`, `GET /:id` |
| `admin` | `GET /audit-logs`, `GET /dashboard/stats` |
| — | `GET /health` (checks DB + Redis), `GET /` (root welcome) |

## 5. Environment Variables Required

Fully documented with placeholder values in [`.env.example`](./.env.example)
— every variable referenced by `src/config/index.ts`, grouped by server,
database, JWT, Google OAuth, Redis, bKash, Cloudinary, and seed accounts.
`config/validateEnv.ts` fails the server at boot (not silently at first
request) if `DATABASE_URL`, `JWT_ACCESS_SECRET`, or `JWT_REFRESH_SECRET`
are missing.

## 6. Security & Performance Checklist

- [x] Helmet configured (`app.ts`)
- [x] CORS has explicit allowed origins (`CORS_ALLOWED_ORIGINS` allowlist, not `origin: true`)
- [x] `express-rate-limit` configured — auth, account-creation, payment-callback, and a general baseline limiter
- [x] Prisma queries use deliberate `select`/`include` — audited every `prisma.user.*` call specifically for accidental password exposure; every response path either `omit`s it or hand-picks fields
- [x] Redis caching with write invalidation — departments/courses/semesters/notices (list+detail) and the admin dashboard stats, all invalidated on the relevant write
- [x] Transactions protect enrollment-seat and payment-callback concurrency — Serializable transaction + retry for enrollment (with a real fix mid-build: the retry's error-shape check didn't match Prisma 7's actual driver-adapter error, so it never engaged until caught by the integration test); a conditional `updateMany` guard for payment finalization (deliberately not a DB transaction — see `payment.service.ts`)
- [x] Indexes on every foreign key and filtered column, plus `deletedAt` on every soft-deletable model

## 7. What Was Built (in order)

1. **Bootstrap** — `.env.example`, fixed app.ts (helmet/CORS-allowlist/compression/request-size-limits/trust-proxy), `/api/v1` structure, centralized error handler (AppError/Zod/Prisma/JWT/Multer), soft-delete + AuditLog added to the schema up front to avoid retrofitting every module later.
2. **Auth & RBAC** — the pre-existing auth module was dead code from an unrelated schema (different enums, missing relations, an empty controller file) and was rewritten from scratch: register/login/refresh (hashed, rotating, revocable)/logout/Google, plus user management (`/users/*`). Fixed a real bug in `checkAuth.ts` that would have thrown on every request.
3. **Seed & migrations** — verified end-to-end: all 4 seeded demo accounts log in via the real API; `prisma db seed` is idempotent.
4. **Full CRUD** — departments, faculties, students, courses, semesters, course-offerings (+ assign-faculty), enrollments, results, notices — with pagination/filter/search on every list endpoint.
5. **Concurrency** — enrollment seat-limit protection, done as part of building the enrollment module rather than bolted on after.
6. **Payments** — bKash tokenized checkout: initiate, verified callback (execute + query cross-check), idempotent finalization. Fixed two real bugs in the pre-existing `lib/bkash.ts` (a wrong Redis key storing the ID token where the refresh token belonged, and a swallowed error returned as if it were a valid token).
7. **Data integrity** — confirmed no hard deletes remain on core resources; `GET /admin/audit-logs`.
8. **Hardening** — `GET /admin/dashboard/stats`; confirmed the rest of the section 6 checklist was already satisfied by earlier phases.
9. **Docs** — Postman collection (verified with `newman`, catching and fixing 5 real issues: a router path-ordering bug that made the payment callback require auth, an Express-5 `req.query` reassignment crash, a data-collision cascade, a missing captured id, and an actor-identity mismatch in the example flow), and this README.
10. **Everything else a production backend needs** — env validation at boot, upload size/type limits, `trust proxy`, response compression, `uncaughtException` handling, a real unit + integration test suite (Node's built-in test runner — the integration test caught the Prisma-7-error-shape bug above), a stricter rate limit on account creation, a multi-stage Dockerfile + docker-compose for local dev, GitHub Actions CI (against a real Postgres service container), and deployment config (Render blueprint) with full deployment steps documented — deploying itself is the user's own action.

## 8. Code & Architecture Conventions

```text
src/
  module/<feature>/
    <feature>.router.ts
    <feature>.controller.ts
    <feature>.service.ts
    <feature>.validation.ts
    <feature>.interface.ts
    <feature>.constant.ts
  middleware/
    checkAuth.ts        auth(...roles) RBAC guard + optionalAuth
    validateRequest.ts  Zod validation for body/query/params
    globalErrorHandler.ts
    rateLimiter.ts
    requestLogger.ts, notFound.ts
  routes/index.ts        mounts every module under /api/v1
  utils/                 AppError, catchAsync, sendResponse, paginationHelper,
                          cache, auditLog, withTransaction, generateId, hash,
                          authCookies, getRequestUser
  lib/                   prisma, redis, cloudinary, googleAuth, multer, bkash
```

Controllers call services, wrap handlers with `catchAsync`, validate with
Zod, and return via `sendResponse`. Success: `{success, statusCode, message,
data, meta?}`. Errors: `{success, statusCode, message, errors?}` via one
centralized handler for `AppError`/`ZodError`/Prisma/`jsonwebtoken`/
`MulterError`/unknown. No response path exposes a password hash, a raw
refresh token, gateway credentials, or a raw Prisma/driver error.

## 9. 5-Day Build Timeline & Progress Tracker

### Day 1 — Planning, Architecture & Database

- [x] Select project & define the core problem domain
- [x] Define the 3 roles and their permissions (enforced by `auth(...roles)` per route, cross-checked in this doc's section 4)
- [x] Plan 20+ API endpoints (68 built)
- [x] Identify core entities, relationships, and design the ERD
- [x] Initialize Node.js, TypeScript, and Express.js project structure
- [x] Configure PostgreSQL connection and set up Prisma ORM
- [x] Create the Prisma schema, run migrations, and write seed data
- [x] Initialize Git repository and make first meaningful commit
- [x] Set up deployment and testing workflow (CI + Dockerfile + docker-compose; live deployment is the user's own action)

### Day 2 — Authentication & Core APIs

- [x] Implement User Registration and Login
- [x] Implement secure password hashing (bcrypt)
- [x] Generate and manage Bearer Tokens (JWT access + refresh, rotation/revocation)
- [x] Create Authentication and RBAC middleware
- [x] Build User/Profile management APIs
- [x] Implement core CRUD APIs
- [x] Create Postman collection and test basic flows (verified with `newman`)

### Day 3 — Business Logic, Validation & Advanced Features

- [x] Complete remaining APIs (68, well past the 20 minimum)
- [x] Implement status transitions and assignment workflows (enrollment status, assign-faculty)
- [x] Add strict Zod validation on POST/PATCH/PUT routes
- [x] Implement centralized error handling with structured JSON responses
- [x] Add pagination, filtering, and sorting
- [x] Implement database transactions (enrollment seat-limit; payment finalization via conditional update)
- [x] Add database indexes for frequently queried fields
- [x] Integrate Redis and file uploads

### Day 4 — Payment Integration & Rigorous Testing

- [x] Integrate a real payment gateway (bKash tokenized checkout)
- [x] Build payment initiation endpoint
- [x] Implement secure webhook/callback verification (execute + query cross-check, idempotent finalization)
- [x] Build payment status endpoints
- [x] Test APIs across all roles and failure cases (manual smoke tests each phase + a committed integration test)
- [x] Test duplicate/not-found/edge cases
- [x] Finalize Postman documentation
- [x] Fix bugs discovered during testing (several real ones — see section 7 and individual commit messages)

### Day 5 — Deployment, Final Polish & Submission

- [x] Configure production environment variables securely (`.env.example`, boot-time validation)
- [ ] Deploy backend and production PostgreSQL — user's own action; config and steps are ready (`Dockerfile`, `render.yaml`, README)
- [ ] Verify live APIs, auth, role restrictions, and payments — pending deployment
- [x] Review Git history for 20+ meaningful commits
- [x] Finalize README with setup/env/demo-credential/endpoint documentation
- [x] Prepare dedicated Admin demo credentials (seed-backed, passwords never committed)
- [ ] Record/upload the API walkthrough video — not requested as part of this build
- [ ] Submit all required links — pending deployment

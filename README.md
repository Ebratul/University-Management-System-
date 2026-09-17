# University Management System — Backend

A REST API for university administration: three roles (**Admin**, **Faculty**,
**Student**), academic resource management (departments, courses, semesters,
course offerings), enrollment with seat-limit protection, results, notices,
and bKash payment integration.

- **Stack:** Node.js, TypeScript, Express 5, PostgreSQL, Prisma ORM 7
- **Auth:** email/password (JWT access + refresh, with rotation/revocation)
  and Google OAuth2 (idToken Bearer)
- **API base path:** `/api/v1`

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values — see "Environment variables" below
npx prisma generate
npx prisma migrate deploy   # applies all committed migrations
npm run seed                 # creates demo accounts (see below)
npm run dev                  # http://localhost:5000
```

Other useful scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server with `tsx watch` |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build (`dist/src/server.js`) |
| `npm run migrate:deploy` | Apply pending Prisma migrations (`prisma migrate deploy`) |
| `npm run seed` | Run `prisma/../src/utils/seed.ts` (idempotent — safe to re-run) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the test suite (`tsx --test`, auto-discovers `*.test.ts`) |
| `npm run lint:check` / `lint:fix` | Biome lint |
| `npm run format:check` / `format:fix` | Biome format |

### Docker (local dev)

```bash
docker compose up
```

Starts Postgres, Redis, and the app (hot-reloading via `tsx watch`, with
`src/` and `prisma/` mounted) in one command — no need to install Postgres
or Redis natively. Copy `.env.example` to `.env` first; `docker-compose.yml`
overrides `DATABASE_URL`/`REDIS_HOST`/`REDIS_PORT` to point at the compose
network's own Postgres/Redis, but every other variable (JWT secrets, bKash,
Cloudinary, seed accounts) still comes from your `.env`.

## CI

`.github/workflows/ci.yml` runs on every push and PR: Biome format/lint
check, `tsc --noEmit`, `prisma generate`, `prisma migrate deploy` against a
real Postgres service container, `npm run build`, and the full test suite
(including the integration test, against that same throwaway database).

## Deployment

`Dockerfile` builds a lean multi-stage production image (see
[Architecture](#architecture) below) and `render.yaml` is a ready-to-use
[Render](https://render.com) blueprint provisioning Postgres, Redis, and the
API as a Docker web service. To deploy:

1. Push this repo to GitHub.
2. In Render, **New +** → **Blueprint**, point it at the repo — it reads
   `render.yaml` and provisions the three services automatically.
3. After the first deploy, open the web service's **Environment** tab and
   set every variable `render.yaml` couldn't fill in automatically (it has
   no safe default to infer): `CORS_ALLOWED_ORIGINS`, `JWT_ACCESS_SECRET`,
   `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`,
   `BCRYPT_SALT_ROUNDS`, `GOOGLE_CLIENT_ID`, the `BKASH_*` vars, the
   `CLOUDINARY_*` vars, and the `SUPER_ADMIN_*`/`TESTER_*` seed vars —
   the same list as `.env.example`, minus `DATABASE_URL`/`REDIS_HOST`/
   `REDIS_PORT`, which the blueprint wires up for you.
4. Redeploy, then run migrations and the seed once against the live
   database — either via Render's **Shell** tab on the web service, or
   locally with `DATABASE_URL` pointed at the deployed database:
   `npm run migrate:deploy && npm run seed`.
5. `BKASH_CALLBACK_URL` needs the deployed URL, e.g.
   `https://university-api.onrender.com/api/v1/payments/callback` — set it
   after step 2 gives you that URL, then redeploy.

Any other Docker-friendly host (Fly.io, Railway, a VPS) works the same way:
build `Dockerfile`'s `production` target, provide Postgres + Redis, set the
same environment variables, run migrations once.

This project's own `render.yaml`/deployment wasn't actually deployed from
this environment — that needs your own Render account and explicit
go-ahead, since it's an external, hard-to-reverse action (provisions real
infrastructure, likely incurs cost beyond a free tier). The steps above are
what you'd run yourself.

## Environment variables

All variables are documented with placeholder values in [`.env.example`](./.env.example).
Nothing in that file is a real secret — copy it to `.env` and fill in your own.

| Group | Variables | Notes |
|---|---|---|
| Server | `NODE_ENV`, `PORT`, `APP_URL`, `CORS_ALLOWED_ORIGINS` | `CORS_ALLOWED_ORIGINS` is a comma-separated allowlist; credentialed requests from any other origin are rejected. |
| Database | `DATABASE_URL` | PostgreSQL connection string, used by Prisma + `@prisma/adapter-pg`. |
| Passwords | `BCRYPT_SALT_ROUNDS` | |
| JWT | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Use long random strings for the secrets — never reuse across environments. |
| Google OAuth | `GOOGLE_CLIENT_ID` | Only the client ID is needed; we only verify idTokens, never mint our own. |
| Redis | `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_HOST`, `REDIS_PORT` | Used for caching (departments/courses/semesters/notices/dashboard stats) and bKash token caching. |
| bKash | `BKASH_BASE_URL`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_CALLBACK_URL` | Sandbox or production tokenized-checkout credentials. Payment endpoints return a clean 503 if these are unset. |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Used by `PATCH /users/profile-image`. |
| Seed accounts | `SUPER_ADMIN_*`, `TESTER_ADMIN_*`, `TESTER_FACULTY_*`, `TESTER_STUDENT_*` | Only read by `npm run seed`, never by the running server. |

## Demo credentials

`npm run seed` creates four accounts from the `SUPER_ADMIN_*` / `TESTER_*` env
vars above (idempotent — it skips any account that already exists). The
**passwords are never committed** — they live only in your local `.env`.
After seeding, log in with:

- `SUPER_ADMIN_EMAIL` — role `ADMIN`
- `TESTER_ADMIN_EMAIL` — role `ADMIN`
- `TESTER_FACULTY_EMAIL` — role `FACULTY`
- `TESTER_STUDENT_EMAIL` — role `STUDENT`

against `POST /api/v1/auth/login`, using whatever password you set for each
in your own `.env`.

## API documentation

Import [`postman_collection.json`](./postman_collection.json) into Postman —
it covers all 68 requests across 15 folders (14 resource folders + a final Cleanup), with example request bodies and
the standard error shape noted on every request. To use it:

1. Import the collection.
2. Open the collection's **Variables** tab and fill in `superAdminPassword`,
   `facultyPassword`, `studentPassword` from your local `.env` (left blank in
   the file on purpose).
3. Run the three **Auth → Login as …** requests first — each has a test
   script that saves the returned access token into a collection variable
   (`adminToken`, `facultyToken`, `studentToken`), which every other request
   authenticates with via a Bearer token variable.
4. Requests that create a resource (department, semester, faculty, student,
   course, course offering, enrollment, result, notice) save the created id
   into a collection variable, so downstream requests chain together
   without manual copy-pasting. Folders are ordered so each dependency
   exists before it's needed (Departments → Semesters → Faculties →
   Students → Courses → Course Offerings → Enrollments → Results). Creating
   a Faculty also logs in as that faculty and overwrites `facultyToken`,
   since Enrollment/Result actions are scoped to whichever faculty actually
   teaches the course offering created later in the run.
5. Every "Delete" request lives in the final **Cleanup** folder, in an order
   that satisfies each resource's dependent-check (e.g. the course offering
   is deleted before the faculty/course it references).

This was validated end-to-end with `newman run postman_collection.json` against
a live local server; if you run it with Postman's own Collection Runner
instead (the intended, documented usage), that's the environment it was
designed and fixed for.

### Response contract

Every response is JSON with a consistent shape:

```jsonc
// success
{ "success": true, "statusCode": 200, "message": "...", "data": { /* ... */ }, "meta": { /* pagination, list endpoints only */ } }

// error
{ "success": false, "statusCode": 400, "message": "Validation failed", "errors": [{ "path": "email", "message": "Invalid email address." }] }
```

`errors` is only present for validation failures with field-level detail;
most errors just carry `message`.

### Endpoint summary

All paths below are relative to `/api/v1`. Full detail (bodies, query
params, RBAC) is in the Postman collection — this is the map.

| Resource | Endpoints | Notes |
|---|---|---|
| `auth` | `POST /register`, `/login`, `/refresh-token`, `/logout`, `/google` | `register` always creates a STUDENT. |
| `users` | `GET/PATCH /me`, `PATCH /profile-image`, `GET/POST /`, `GET /:id`, `PATCH /:id/role`, `PATCH /:id/status`, `DELETE /:id` | List/create/role/status/delete are Admin-only. |
| `departments`, `courses`, `semesters` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` | Reads are public (catalog data); writes are Admin-only. Cached in Redis, invalidated on write. |
| `faculties` | same shape | Public directory; writes Admin-only. |
| `students` | same shape | PII — list/getById/writes are Admin-only (getById also allows the faculty teaching them and the student themselves). |
| `course-offerings` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `POST /:id/assign-faculty`, `DELETE /:id` | Includes a live `seatsRemaining`. |
| `enrollments` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id/status` | `POST` is Student self-enroll; seat-limit checked in a Serializable transaction. |
| `results` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id` | Faculty is scoped to offerings they teach; publishing auto-completes the enrollment. |
| `notices` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` | Public, audience-filtered by whoever's logged in (or ALL if no one is). |
| `payments` | `POST /initiate`, `GET /callback`, `GET /`, `GET /:id` | `callback` is public — bKash's redirect target. Amount is server-set per semester, never client-supplied. |
| `admin` | `GET /audit-logs`, `GET /dashboard/stats` | Admin only. Every mutating endpoint above writes to the audit log. |
| — | `GET /health` | Public DB connectivity check. |

## Architecture

```
src/
  module/<feature>/
    <feature>.router.ts        Express routes + validateRequest + auth()
    <feature>.controller.ts    catchAsync handlers, calls the service, sendResponse
    <feature>.service.ts       Prisma queries + business rules
    <feature>.validation.ts    Zod schemas
    <feature>.interface.ts     payload/query types
    <feature>.constant.ts      sortable-field allowlists etc.
  middleware/
    checkAuth.ts       auth(...roles) RBAC guard + optionalAuth for public-but-personalized routes
    validateRequest.ts Zod validation for body/query/params
    globalErrorHandler.ts  AppError/Zod/Prisma/JWT -> standardized JSON error
    rateLimiter.ts      authLimiter, paymentCallbackLimiter, generalLimiter
    requestLogger.ts, notFound.ts
  routes/index.ts       mounts every module router under /api/v1
  utils/
    AppError.ts, catchAsync.ts, sendResponse.ts
    paginationHelper.ts  page/limit/sortBy/sortOrder -> skip/take/orderBy + meta
    cache.ts             Redis read-through cache + prefix invalidation
    auditLog.ts          writes AuditLog rows (never throws)
    withTransaction.ts   Serializable transaction + retry-on-conflict helper
    generateId.ts, hash.ts, authCookies.ts, getRequestUser.ts
  lib/                  prisma, redis, cloudinary, googleAuth, multer, bkash clients
```

**Soft delete:** every core model (`User`, `Admin`, `Faculty`, `Student`,
`Department`, `Course`, `Semester`, `CourseOffering`, `Enrollment`, `Result`,
`Payment`, `Notice`) has a `deletedAt` column; every read filters it out and
every "delete" endpoint sets it instead of removing the row. `RefreshToken`
is the one exception — it's ephemeral session state, so rotation/logout
hard-delete it on purpose.

**Concurrency:** enrollment seat limits and the payment callback's
finalization are both protected against races — see
`src/utils/withTransaction.ts` (Serializable isolation + retry on Postgres's
write-conflict error) and `payment.service.ts`'s conditional
`updateMany({ where: { status: PENDING } })` respectively.

**Audit log:** every mutating service call writes an `AuditLog` row (who,
what, when, and enough context to reconstruct the change) via
`utils/auditLog.ts`, surfaced at `GET /api/v1/admin/audit-logs`.

## Known limitations

- **bKash end-to-end flow is untested against a live sandbox session** from
  this environment — the code follows bKash's documented tokenized-checkout
  flow (grant → create → execute → query) and fails cleanly (502/503, never
  a crash) when the gateway is unreachable or misconfigured, but a real
  successful checkout needs you to exercise it with working sandbox
  credentials and an actual browser redirect.
- **Soft-deleted unique values aren't freed for reuse.** Postgres unique
  constraints (`User.email`, `Course.courseCode`, `Semester.code`, etc.)
  aren't aware of `deletedAt` — Prisma's schema language can't express a
  partial index (`WHERE deletedAt IS NULL`) without dropping to raw SQL. In
  practice this means re-registering with the exact email of a
  soft-deleted account, or recreating a course with the same code, will hit
  a duplicate-key error. This is a known, common simplification; fixing it
  properly means adding partial unique indexes via a raw-SQL migration.
- **Role changes are intentionally conservative:** `PATCH /users/:id/role`
  only switches to a role the user already has a profile for — it will not
  fabricate a Student profile with no department, for example. Create the
  target profile first via the relevant resource endpoint.

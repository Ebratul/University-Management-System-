# University Management System — Project Requirements

> **Review basis:** all currently present files under `src/`, the Prisma schema directory (`prisma/schema/`), `package.json`, migrations, `.gitignore`, and the available workspace metadata. The requested `prisma/schema.prisma`, `.env.example`, and Git history are not present at those paths; this is recorded below rather than inferred.

## 1. Project Overview

Backend for university administration and academic operations across three roles:

- **ADMIN** — manage users, academic resources, payments, notices, and oversight.
- **FACULTY** — manage assigned course activity and student results.
- **STUDENT** — manage profile, enrollment, results, and payments.

**Detected stack:** Node.js, TypeScript, Express 5, PostgreSQL, Prisma ORM 7 with `@prisma/adapter-pg`, `tsx`, `dotenv`, `cors`, `cookie-parser`, `jsonwebtoken`, `bcryptjs`, `google-auth-library`, `zod`, `redis`, Multer, Cloudinary, Nodemailer, PDFKit, `date-fns`, `node-cron`, `http-status`, and Biome. Only Express/Prisma bootstrap code is currently implemented; installed packages are not proof of completed features.

## 2. Mandatory Requirements Checklist

| Requirement | Status |
|---|---|
| API Documentation (Postman/Swagger) | [ ] Not found |
| Consistent JSON response format | [ ] Partial only: `sendResponse` exists, but root/404 responses differ and no feature routes use it |
| Minimum 20 meaningful git commits | [ ] Cannot verify: no `.git` directory/history is available |
| Minimum 20 meaningful, documented API endpoints | [ ] Only `/` and a 404 fallback exist |
| API versioning (`/api/v1/...`) | [ ] No versioned routes |
| Server-side Zod validation with field errors | [ ] Zod is installed but unused |
| Email/password + Google OAuth2 Bearer authentication | [ ] Libraries/schema fields exist, implementation absent |
| Strict 3-role RBAC middleware | [ ] Role enum exists; middleware absent |
| Working demo admin credentials | [ ] No seed data or documented credentials |
| Real payment integration and verified callbacks | [ ] Payment model exists; gateway/webhook absent |
| PostgreSQL + Prisma relationships, constraints, indexes, transactions | [x] PostgreSQL schema, relations, unique constraints, and several indexes exist; [ ] transaction usage not implemented |
| Password hashing, secret protection, protected private routes | [ ] No auth routes/hashing/private routes; `.env` is ignored |
| `express-rate-limit` on sensitive/public routes | [ ] Package/configuration absent |
| Helmet and properly configured CORS | [ ] CORS exists but allows every origin; helmet absent |
| Soft deletes using `deletedAt` on core resources | [ ] No model has `deletedAt` |
| Audit logs/activity tracking | [ ] No `AuditLog` model or service |
| Pagination on a list endpoint | [ ] No list endpoints; only a pagination type exists in `sendResponse` |
| Filtering/sorting on a list endpoint | [ ] Not implemented |
| Search (`q=keyword`) where relevant | [ ] Not implemented |
| Deployment to a live URL | [ ] No deployment configuration or URL found |

## 3. Database Schema Reference

The configured schema is the multi-file directory `prisma/schema/`; there is no root `prisma/schema.prisma`.

| Model | Key fields | Relations / constraints | Soft delete |
|---|---|---|---|
| `User` | `id`, unique `email`, optional `password`/`googleId`, `role`, `isActive`, timestamps | Admin/Faculty/Student profiles, refresh tokens, notices; role index | Missing |
| `RefreshToken` | `id`, unique `token`, `userId`, `expiresAt`, `createdAt` | User cascade relation; user index | Missing |
| `Admin` | `id`, unique `userId`, `name`, `phone`, timestamps | One-to-one User; User cascade | Missing |
| `Department` | `id`, unique `name`/`code`, timestamps | Faculties, courses, students; no extra index needed for unique fields | Missing |
| `Faculty` | `id`, unique `userId`/`facultyId`, `name`, `designation`, `phone`, `departmentId` | User and Department; department index; course offerings | Missing |
| `Student` | `id`, unique `userId`/`studentId`, `name`, `phone`, DOB, department/admission semester IDs | User, Department, Semester; department/admission indexes; enrollments/payments | Missing |
| `Course` | `id`, unique `courseCode`, `title`, `credits`, `departmentId`, timestamps | Department; department index; offerings | Missing |
| `Semester` | `id`, `year`, unique `code`, dates, `status`, timestamps | Offerings, semester payments, admitted students; status index | Missing |
| `CourseOffering` | `id`, `maxSeats`, course/faculty/semester IDs, timestamps | Unique `(courseId, semesterId, facultyId)`; semester/faculty indexes; enrollments | Missing |
| `Enrollment` | `id`, `status`, student/offering IDs, enrolled/updated timestamps | Unique `(studentId, courseOfferingId)`; offering/status indexes; optional Result | Missing |
| `Result` | `id`, `grade`, `gradePoint`, unique `enrollmentId`, publication/update dates | One-to-one Enrollment cascade | Missing |
| `Payment` | `id`, `amount`, unique `transactionId`, `status`, method, student/semester IDs, dates | Student/Semester; student/semester/status indexes | Missing |
| `Notice` | `id`, title/content, `audience`, `postedByUserId`, timestamps | User author; audience index | Missing |

Enums are `Role`, `SemesterStatus`, `EnrollmentStatus`, `PaymentStatus`, and `NoticeAudience`. A migration exists, but no seed script was found. There is no `AuditLog`; payment lacks gateway/callback metadata; no soft-delete field exists; and core relations use cascade deletes that conflict with the required soft-delete policy.

## 4. Full API Endpoint Inventory (Target: 20+ endpoints)

No controller, service, route, validation, or middleware modules currently exist. The inventory below is the required target mapped to the intended modules; statuses reflect the code review.

| Method | Path | Role access | Pagination/filter/search | Status |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | No | Not started |
| POST | `/api/v1/auth/login` | Public | No | Not started |
| POST | `/api/v1/auth/refresh-token` | Public/refresh token | No | Not started |
| POST | `/api/v1/auth/logout` | Authenticated | No | Not started |
| GET | `/api/v1/users/me` | All authenticated | No | Not started |
| PATCH | `/api/v1/users/me` | All authenticated | No | Not started |
| GET | `/api/v1/users` | Admin | `page`, `limit`, `role`, `q`, `sortBy` | Not started |
| PATCH | `/api/v1/users/:id/role` | Admin | No | Not started |
| GET/POST | `/api/v1/departments`, `/api/v1/departments/:id` | All/Admin | List: pagination, `q`, sorting | Not started |
| PATCH/DELETE | `/api/v1/departments/:id` | Admin | No | Not started |
| GET/POST | `/api/v1/faculties`, `/api/v1/faculties/:id` | Admin; all read | List: pagination, department filter, `q` | Not started |
| PATCH/DELETE | `/api/v1/faculties/:id` | Admin | No | Not started |
| GET/POST | `/api/v1/students`, `/api/v1/students/:id` | Admin; scoped student read | List: pagination, department/status filter, `q` | Not started |
| PATCH/DELETE | `/api/v1/students/:id` | Admin/student self | No | Not started |
| GET/POST | `/api/v1/courses`, `/api/v1/courses/:id` | Admin; all read | List: pagination, department filter, `q`, sort | Not started |
| PATCH/DELETE | `/api/v1/courses/:id` | Admin | No | Not started |
| GET/POST | `/api/v1/semesters`, `/api/v1/semesters/:id` | Admin; all read | List: pagination, status filter, sort | Not started |
| PATCH/DELETE | `/api/v1/semesters/:id` | Admin | No | Not started |
| GET/POST | `/api/v1/course-offerings`, `/api/v1/course-offerings/:id` | Admin; all read | List: pagination, semester/course/faculty filters | Not started |
| PATCH/DELETE | `/api/v1/course-offerings/:id` | Admin | No | Not started |
| POST | `/api/v1/course-offerings/:id/assign-faculty` | Admin | No | Not started |
| GET/POST | `/api/v1/enrollments`, `/api/v1/enrollments/:id` | Student create; admin/faculty read | List: pagination, status/student/offering filters | Not started |
| PATCH | `/api/v1/enrollments/:id/status` | Admin/faculty | No | Not started |
| GET/POST | `/api/v1/results`, `/api/v1/results/:id` | Faculty/admin write; student read | List: pagination, student/semester filter | Not started |
| PATCH | `/api/v1/results/:id` | Faculty/admin | No | Not started |
| POST | `/api/v1/payments/initiate` | Student | No | Not started |
| POST | `/api/v1/payments/webhook` | Gateway signature/public | No | Not started |
| GET | `/api/v1/payments/:id` | Student/admin | No | Not started |
| GET/POST | `/api/v1/notices`, `/api/v1/notices/:id` | All read; admin write | List: pagination, audience filter, `q` | Not started |
| PATCH/DELETE | `/api/v1/notices/:id` | Admin | No | Not started |
| GET | `/api/v1/admin/dashboard/stats` | Admin | No | Not started |
| GET | `/api/v1/admin/audit-logs` | Admin | Pagination, action/date filters | Not started |
| GET | `/` | Public | No | Done (health/welcome response only; message is stale “PH Healthcare”) |

## 5. Environment Variables Required

No `.env.example` file exists. Current source/config references only:

| Variable | Description | `.env.example` status |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string for Prisma and `PrismaPg` | Missing |
| `PORT` | HTTP server port | Missing |
| `APP_URL` | Application URL exposed by config; currently not used elsewhere | Missing |

For the required end state, add and document (without committing values): `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, access/refresh expiry values, Google OAuth client ID/secret/callback URL, payment gateway credentials and webhook secret, `REDIS_URL`, CORS allowed origins, SMTP credentials, Cloudinary credentials, and production `NODE_ENV`. These are not currently referenced by source and therefore are future requirements, not current runtime dependencies.

## 6. Security & Performance Checklist

- [ ] Helmet configured — package/configuration absent.
- [ ] CORS has explicit allowed origins — currently `origin: true`, which reflects any origin.
- [ ] `express-rate-limit` configured — package and middleware absent.
- [ ] Prisma queries use deliberate `select`/`include` — no feature queries exist to evaluate.
- [ ] Redis caching with write invalidation — Redis is installed but unused.
- [ ] Transactions protect enrollment/seat/payment concurrency — no transactions or business services exist.
- [x] Indexes exist on several foreign keys and filtered columns — department, semester, faculty, status, student, offering, and audience indexes are present; review remaining query-driven indexes after endpoints exist.

## 7. Remaining Work / Gaps

Priority order for an end-to-end submission:

1. Create `.env.example`, define environment validation, and fix the application bootstrap/response contract (including the duplicate `Request` import and stale root message).
2. Build `/api/v1` route/module structure, centralized errors, `sendResponse` success/error shapes, Zod validation, authentication, JWT refresh/revocation, Google OAuth, and strict RBAC.
3. Add seed data, including a working admin credential documented safely for demo use; finish migrations and verify PostgreSQL connectivity.
4. Implement CRUD/list/search/filter/pagination endpoints for all core resources and the business operations for assignments, enrollment transitions, results, and notices.
5. Add `deletedAt` to core models and replace hard-delete behavior; add `AuditLog` plus critical-action recording.
6. Implement enrollment seat protection and other concurrency-sensitive workflows inside Prisma transactions.
7. Integrate a real payment provider with signed initiation, webhook/callback verification, idempotency, and status retrieval.
8. Add helmet, explicit CORS, rate limiting, deliberate Prisma projections, Redis caching/invalidation, and security tests.
9. Create Postman/Swagger documentation, automated tests, deployment configuration, live deployment, production secrets, and a walkthrough video.
10. Initialize/restore Git tracking and reach 20+ meaningful commits; this workspace currently has no readable Git history.

## 8. Code & Architecture Conventions

The current code has only a thin bootstrap/utilities pattern: `server.ts` connects Prisma and starts Express; `app.ts` configures middleware and fallback routes; `config/index.ts` loads dotenv; `lib/prisma.ts` owns the Prisma client; and utilities provide `AppError`, `catchAsync`, and `sendResponse`.

No controller/service/route/validation modules are established yet. Use this convention for the build:

```text
src/
  modules/<feature>/
    <feature>.route.ts
    <feature>.controller.ts
    <feature>.service.ts
    <feature>.validation.ts
    <feature>.constant.ts
  middlewares/
    auth.ts
    validateRequest.ts
    errorHandler.ts
  routes/index.ts
```

All controllers should call services, wrap async handlers with `catchAsync`, validate request bodies/params/query with Zod, and return `sendResponse`. Standardize success as `{ success, message, data }` and errors as `{ success, message, errors }`; use one centralized error handler for `AppError`, Zod, Prisma, JWT, and unknown errors. Do not expose passwords, refresh-token secrets, gateway credentials, or raw Prisma errors.

## 9. 5-Day Build Timeline & Progress Tracker

### Day 1 — Planning, Architecture & Database

- [x] Select project & define the core problem domain
- [x] Define the 3 distinct roles and map out their exact permissions (roles exist; exact permissions are not documented)
- [ ] Plan 20+ API endpoints
- [x] Identify core entities, relationships, and design the ERD (schema provides the model design)
- [x] Initialize Node.js, TypeScript, and Express.js project structure
- [x] Configure PostgreSQL connection and set up Prisma ORM
- [ ] Create the initial Prisma schema, run migrations, and write seed data (schema/migration exist; seed is missing)
- [ ] Initialize Git repository and make first meaningful commit (no Git metadata available)
- [ ] Set up initial deployment and testing workflow

### Day 2 — Authentication & Core APIs

- [ ] Implement User Registration and Login
- [ ] Implement secure password hashing (bcrypt)
- [ ] Generate and manage Bearer Tokens (JWT)
- [ ] Create Authentication and RBAC middleware
- [ ] Build User/Profile management APIs
- [ ] Implement core CRUD APIs
- [ ] Create initial Postman collection and test basic flows

### Day 3 — Business Logic, Validation & Advanced Features

- [ ] Complete remaining APIs to reach the minimum 20 endpoints
- [ ] Implement status transitions and assignment workflows
- [ ] Add strict Zod validation on POST/PATCH/PUT routes
- [ ] Implement centralized error handling with structured JSON responses
- [ ] Add pagination, filtering, and sorting
- [ ] Implement database transactions
- [x] Add database indexes for frequently queried fields (partial schema coverage)
- [ ] Integrate Redis and/or file uploads

### Day 4 — Payment Integration & Rigorous Testing

- [ ] Integrate a real payment gateway
- [ ] Build payment initiation endpoint
- [ ] Implement secure webhook/callback verification
- [ ] Build payment status endpoints
- [ ] Test APIs across all roles and failure cases
- [ ] Test duplicate/not-found/edge cases
- [ ] Finalize Postman/Swagger documentation
- [ ] Fix bugs discovered during testing

### Day 5 — Deployment, Final Polish & Submission

- [ ] Configure production environment variables securely
- [ ] Deploy backend and production PostgreSQL
- [ ] Verify live APIs, auth, role restrictions, and payments
- [ ] Review Git history for 20+ meaningful commits
- [ ] Finalize README with submission links/instructions
- [ ] Prepare dedicated Admin demo credentials
- [ ] Record/upload the API walkthrough video
- [ ] Submit all required links

**Based on git log and code review, this project is currently at approximately Day 1 of the 5-day plan.**

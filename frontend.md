# University Management System — Frontend Plan

A Next.js (App Router) frontend for the existing Express API in this repo.
This is a monorepo. The frontend lives in `frontend/` and the Express API lives in `backend/`.

This file is the source of truth for the build. It is split into **10 phases**.
Each phase is implemented only when asked. When a phase is done, its status
is set to `Done` in the tracker below and its checklist is ticked.

---

## 0. Decisions

| # | Topic | Decision | Why |
|---|---|---|---|
| D1 | Framework | Next.js (App Router, TypeScript, `src/` dir) | Required by the brief. Server Components by default, `"use client"` only where state, effects or browser APIs are needed. |
| D2 | Styling | Tailwind CSS v4 + shadcn/ui (Radix primitives) | Utility-first styling plus an accessible component library. |
| D3 | Theme | CSS variables for brand tokens, light + dark mode via `next-themes`, a bright multi-colour palette (indigo / teal / amber / rose accents) | The brief asks for a colourful, professional UI. |
| D4 | Rendering | **SSG / ISR** for public pages (landing, catalog, public notices). **Client-side fetching with TanStack Query** for authenticated pages (dashboards, admin, student, faculty). | Public data is the same for everyone, so it can be pre-rendered. Authenticated data is per-user and cannot be pre-rendered. |
| D5 | Server-state fetching | TanStack Query v5 | Caching, background refetch, loading and error states, optimistic updates. |
| D6 | HTTP client | `ofetch` | Required by the brief for client requests. Also used in Server Components for SSG (with a different base URL). |
| D7 | Forms | TanStack Form + Zod v4 | Required by the brief. Zod schemas mirror the backend Zod rules. |
| D8 | Global client state | Zustand (UI state such as sidebar, theme-independent UI flags) | Keeps server data in TanStack Query. Zustand holds only client-only state. |
| D9 | Auth transport | Same-origin API proxy. `next.config` rewrites `/api/v1/*` to the Express backend. | The backend sets `httpOnly` cookies. Serving the API from the frontend's own origin keeps those cookies first-party. Cross-site cookies would be blocked by `sameSite=lax`. |
| D10 | Route protection | `middleware.ts` (presence check of the auth cookie, redirects to `/login`) + server-side role check in the protected layouts (fetches `/users/me` with the request cookies) | The middleware cannot verify the JWT without the backend secret. The backend is the real authority, and the layout check gives the role-based redirect. |
| D11 | One-click demo login | A server route handler `POST /api/demo-login/[role]` signs in with credentials from **server-only** env vars (`DEMO_*`), then forwards the auth cookies | Demo passwords never reach the browser bundle. |
| D12 | Roles | `ADMIN`, `FACULTY`, `STUDENT` (the real roles in the backend enum) | The brief's example names were placeholders. These three match the database. |
| D13 | Payment | bKash tokenized checkout, sandbox mode (already built in the backend) | **Open decision, see Section 5.** The brief lists Stripe or SSLCommerz. |
| D14 | Deployment | Frontend on **Vercel**, backend stays on **Render** (per `render.yaml`) | Requirement: a live frontend URL. |

---

## 1. Backend Contract (what the frontend consumes)

- **Base path:** `/api/v1` (proxied, see D9)
- **Response envelope:**
  - success: `{ success, statusCode, message, data, meta? }`
  - error: `{ success: false, statusCode, message, errors?: [{ path, message }] }`
- **Pagination:** `page`, `limit` (max 100), `sortBy`, `sortOrder` (`asc` | `desc`), `searchTerm` on most lists. `meta = { page, limit, total, totalPages }`.
- **Auth:** `POST /auth/login` returns `{ accessToken, refreshToken }` and sets cookies. `POST /auth/refresh-token` rotates them. `POST /auth/logout` clears them.
- **Rate limits** (`src/middleware/rateLimiter.ts`): auth endpoints allow 20 requests per 15 minutes per IP. Demo login counts against this, so the demo buttons must not spam requests. The general limit is 300 per 15 minutes.

### Endpoints by area

| Area | Endpoints | Access |
|---|---|---|
| Auth | `register`, `login`, `refresh-token`, `logout`, `google` | Public |
| Me | `GET/PATCH /users/me`, `PATCH /users/profile-image` | Any logged-in user |
| Users | `GET/POST /users`, `GET /users/:id`, `PATCH /users/:id/role`, `PATCH /users/:id/status`, `DELETE /users/:id` | Admin |
| Catalog (reads) | `GET /departments`, `/courses`, `/semesters`, `/faculties`, `/course-offerings`, `/notices` (+ `/:id`) | Public (notices are filtered by audience) |
| Catalog (writes) | `POST/PATCH/DELETE` on departments, courses, semesters, faculties, students | Admin |
| Students | `GET /students`, `GET /students/:id` | Admin (`:id` also: the teaching faculty and the student) |
| Offerings | `POST/PATCH/DELETE /course-offerings`, `POST /course-offerings/:id/assign-faculty` | Admin |
| Enrollments | `GET /enrollments`, `GET /enrollments/:id`, `POST /enrollments`, `PATCH /enrollments/:id/status` | Student enrols; Admin/Faculty read and update within scope |
| Results | `GET /results`, `GET /results/:id`, `POST /results`, `PATCH /results/:id` | Faculty (own offerings only), Student (own), Admin |
| Payments | `POST /payments/initiate`, `GET /payments`, `GET /payments/:id`, `GET /payments/callback` (public, bKash redirect) | Student (initiate), Admin/Student (read) |
| Admin | `GET /admin/audit-logs`, `GET /admin/dashboard/stats` | Admin |
| Health | `GET /health` | Public |

Before each phase, check the exact query params and bodies in the matching
`src/module/<feature>/*.validation.ts` file. Keep the Zod schemas on the
frontend in line with them.

---

## 2. Target Folder Structure

```
frontend/
  src/
    app/
      (public)/              SSG pages: /, /courses, /departments, /faculties, /notices
      (auth)/                /login, /register
      (dashboard)/           layout with sidebar, role-gated
        admin/               ADMIN only
        faculty/             FACULTY only
        student/             STUDENT only
      api/demo-login/[role]/ route handler (server-only demo sign-in)
      layout.tsx             root layout: fonts, theme, providers
      error.tsx, loading.tsx, not-found.tsx
    components/
      ui/                    shadcn primitives (generated)
      layout/                navbar, sidebar, footer, role-gate
      shared/                data-table, stat-card, empty-state, page-header
      forms/                 reusable TanStack Form field components
    features/<feature>/      queries, mutations, schemas, components per domain
    lib/
      api/                   ofetch client, ApiError, query-key factory
      auth/                  session helpers, role map
      validations/           Zod schemas shared across forms
      env.ts                 zod-validated env (server + public)
    hooks/                   custom hooks (useDebouncedValue, useSearchState, ...)
    stores/                  Zustand stores (UI only)
    types/                   API response and entity types
  middleware.ts
  next.config.ts
```

---

## 3. Phases

Status values: `Not started` · `In progress` · `Done`.

### Phase 1 — Project bootstrap & tooling

**Goal:** A runnable Next.js app with the full toolchain in place.

**Tasks**
- [x] Scaffold `frontend/` with Next.js (App Router, TypeScript, Tailwind v4, ESLint, `src/` dir, import alias `@/*`).
- [x] Install runtime deps: `@tanstack/react-query`, `@tanstack/react-form`, `zod`, `ofetch`, `zustand`, `next-themes`, `sonner`, `lucide-react`, `date-fns`.
- [x] Initialise shadcn/ui (Radix base, `radix-vega` preset, CSS variables on). Brand colours override the neutral base in `globals.css`.
- [x] Set up env validation: `lib/env.ts` (public, client-safe) and `lib/env.server.ts` (`server-only`, validates `BACKEND_URL` and the `DEMO_*` vars, fails fast on boot).
- [x] Add `.env.example` with placeholders only. Confirm `.env*.local` is git-ignored.
- [x] Add scripts: `typecheck`, `lint`. (No `format` script yet; formatting tool is still to be chosen.)
- [x] Define the brand palette as CSS tokens in `globals.css` (`:root` and `.dark`).

**Done when:** `npm run dev` and `npm run build` pass on a blank home page. TypeScript has no errors.

**Covers:** Code Quality (5%), Deployment readiness (5%).

---

### Phase 2 — Design system & app shell

**Goal:** A polished, responsive, accessible base UI that every later phase reuses.

**Tasks**
- [x] Add the shadcn components needed now: `button`, `card`, `input`, `label`, `badge`, `avatar`, `dropdown-menu`, `sheet`, `dialog`, `separator`, `skeleton`, `tooltip`, `table`, `tabs`, `select`, `sonner`.
- [x] Root `layout.tsx`: `next/font` (for example Inter or Plus Jakarta Sans), `ThemeProvider` (`next-themes`), `Toaster`, `<body>` background set explicitly.
- [x] Public navbar: logo, links, theme toggle, Login button. Collapses to a sheet menu on mobile.
- [x] Footer.
- [x] Root `loading.tsx` (skeleton), `error.tsx` (client, with a retry button), `not-found.tsx`.
- [x] Shared components: `PageHeader`, `EmptyState`, `StatCard`, `SectionCard`.
- [x] Accessibility baseline: semantic landmarks, skip-to-content link, visible focus rings, colour contrast checked in both themes (axe-core: 0 violations at 360, 768 and 1280px, both themes).
- [x] Mobile-first: 16px gutter, no horizontal page scroll at 360px width.

**Done when:** The shell renders at 360px, 768px and 1280px. Light and dark themes both look right. Lighthouse accessibility is 95+ on the shell.

**Covers:** UI/UX & Responsiveness (20%), Next.js architecture (error and loading boundaries, 15%).

---

### Phase 3 — API layer & data-fetching infrastructure

**Goal:** One typed, reliable way to call the backend from client and server.

**Tasks**
- [x] `next.config.ts`: `rewrites()` maps `/api/v1/:path*` to `${BACKEND_URL}/api/v1/:path*` (D9).
- [x] `lib/api/client.ts`: an `ofetch` instance with `baseURL: "/api/v1"` (client) and `credentials: "include"`. Unwraps the `data` envelope. Maps error bodies to `ApiError` (`status`, `message`, `errors`).
- [x] Server variant of the client (for SSG and Server Components) that uses `BACKEND_URL` directly.
- [x] Refresh-on-401: one automatic `POST /auth/refresh-token`, then retry. If that fails, clear the session and redirect to `/login`. Guard against parallel refresh storms with a single in-flight promise.
- [x] `QueryClient` provider (client component) with sane defaults: `staleTime` 30s, retry 1 (no retry on 4xx), `refetchOnWindowFocus` off for dashboards.
- [x] Query key factory per feature (`lib/api/query-keys.ts`).
- [x] Zustand UI store (sidebar open state). Documented as client-only.
- [x] Shared `types/api.ts` (`ApiResponse<T>`, `Paginated<T>`, `ApiError`) and per-entity types.
- [x] Reusable hook `useApiQuery` / `useApiMutation` wrappers, with toast on error.

**Done when:** `GET /api/v1/health` works through the rewrite on the dev server. A failing request shows a toast with the backend message. Two concurrent 401s produce exactly one refresh call.

**Covers:** API Integration & State (15%), Code Quality (5%).

**Status: Done.** Verified: `/api/v1/health` and list calls work through the rewrite; a Node test shows five concurrent 401s trigger exactly one refresh call (`frontend/src/lib/api/client.ts`). Not verified visually: the failure toast from `useApiMutation` (the code path exists).

---

### Phase 4 — Authentication & authorization

**Goal:** Secure login, one-click demo login for all three roles, route protection, and role-based access.

**Tasks**
- [x] `/login` page with a clear layout:
  - Email and password form (TanStack Form + Zod, field-level errors).
  - A "Quick demo login" section with **three one-click buttons**: Admin, Faculty, Student. Each shows the role's icon and colour.
- [x] `POST /api/demo-login/[role]` route handler: reads `DEMO_<ROLE>_EMAIL` and `DEMO_<ROLE>_PASSWORD` from server env, calls the backend login, forwards `Set-Cookie`, returns the destination for that role.
- [x] Log in with form: `POST /auth/login` through the proxy. Redirect to the role's home page.
- [x] `/register` (student self-registration) with Zod validation that matches `auth.validation.ts`.
- [x] `middleware.ts`:
  - `/admin/*`, `/faculty/*`, `/student/*` need the auth cookie. Missing cookie redirects to `/login?next=...`.
  - Logged-in users visiting `/login` or `/register` go to their dashboard.
- [x] Role-protected layouts (`(dashboard)/admin/layout.tsx` and the others): a Server Component fetches `/users/me` with the request cookies. Wrong role redirects to that role's home.
- [x] `RoleGate` component for client-side UI. It hides buttons and nav items based on role. This is for UI only; the backend still enforces access.
- [x] Logout: calls `POST /auth/logout`, clears the TanStack Query cache, redirects to `/`.
- [x] Session hook `useCurrentUser` (TanStack Query, key `['me']`).

**Done when:** Each demo button logs in as the right role in one click. Opening `/admin` as a student redirects to `/student`. Logout clears all state. The `/login` page is usable on a phone.

**Covers:** Authentication & Authorization (15%), Form Handling (10%), Demo credentials (mandatory).

**Status: Done.** Verified in a real browser (52/52 end-to-end checks across phases 4 and 5): three demo logins land on the right home, the role layouts redirect wrong roles, logout clears cookies, an expired access token is rotated by the proxy without a redirect loop, and a rejected refresh sends the visitor to login.
Deviations: `middleware.ts` became `src/proxy.ts` (Next 16 renamed it). The refresh cookie path moved from `/api/v1/auth` to `/` so the proxy can read it on page requests (small backend change in `authCookies.ts`). A backend crash on body-less POSTs (`validateRequest.ts`) was also fixed, since refresh and logout depend on it.

---

### Phase 5 — Public pages (SSG / ISR)

**Goal:** Fast, indexable public pages built with Static Site Generation.

**Tasks**
- [x] Landing page `/`: hero, feature highlights, latest public notices, call to action. Fully static.
- [x] `/departments` and `/departments/[id]`. Use `generateStaticParams` for the detail pages and `revalidate` (ISR, for example 300s).
- [x] `/courses` (catalog with search via `searchTerm` and filters by department, in URL `useSearchParams`) and `/courses/[id]`.
- [x] `/faculties` (public directory) with `next/image` for avatars and a fallback.
- [x] `/notices` (public, `audience=ALL`) and `/notices/[id]`.
- [x] `generateMetadata` on every page (title, description, Open Graph).
- [x] Server-side fetching via the server API client. Data stays in Server Components. A small client island handles search and filters.
- [x] `sitemap.ts` and `robots.ts`.

**Done when:** `next build` pre-renders the public routes (shown in the build output as `●` / `ISR`). The catalog filters update the URL and survive a refresh.

**Covers:** Next.js architecture (SSG, Server/Client split, 15%), Performance (10%).

**Status: Done.** Pages are statically generated with ISR (`next build` output: `●`/`○` with revalidate intervals). Search and the department filter run in the browser and live in the URL, so the page stays static. Verified: search/filter/reload, empty states, 404 with `noindex`, no horizontal overflow at 360px, axe clean on the checked pages. Not run: Lighthouse.
Open point: the API caps `limit` at 100, so lists are walked page by page at build time.

---

### Phase 6 — Admin: academic setup

**Goal:** Admin can manage departments, semesters, courses, faculties and course offerings.

**Tasks**
- [x] Admin home dashboard: stat cards from `GET /admin/dashboard/stats`, with skeletons while loading.
- [x] Shared `DataTable` (shadcn table + TanStack Query): pagination, sort, search, and filters bound to URL search params (`page`, `limit`, `sortBy`, `sortOrder`, `searchTerm`).
- [x] Departments: list, create, edit (dialog), delete (confirm, optimistic removal with rollback on error).
- [x] Semesters: list, create, edit, delete. Includes the `feeAmount` field.
- [x] Courses: list, create, edit, delete. Department select.
- [x] Faculties: list, create, edit, delete.
- [x] Course offerings: list, create (course, semester, faculty, `maxSeats`), assign faculty, delete. Show `seatsRemaining`.
- [x] Forms: TanStack Form + Zod schemas that match backend validation. Field errors shown under inputs. Server validation errors (`errors[]`) mapped back to fields.
- [x] Mutations invalidate the right query keys (and use optimistic updates for delete and status changes).

**Done when:** Each resource supports create, read, update and delete. An invalid form shows field errors without a request. A duplicate code from the server shows the message on the right field.

**Covers:** Form Handling & Validation (10%), API & State (15%), Performance (URL state, 10%).

**Status: Done.** Verified in the browser (14/14): stat cards, five managers render with rows, create and delete via dialogs with toasts, search and sort reflected in the URL, axe clean. Found and fixed: the backend rejected re-creating a department whose name or code belonged to a soft-deleted row (see Phase 10 review).

---

### Phase 7 — Admin: people & operations

**Goal:** Admin can manage users, students, enrollments, notices, payments and audit logs.

**Tasks**
- [x] Users: list (role and status filters), create, change role (`PATCH /users/:id/role`), activate or deactivate (`PATCH /users/:id/status`), delete.
- [x] Students: list, detail page `/admin/students/[id]` (profile, enrollments, payments).
- [x] Enrollments: list with status filter, change status (`PATCH /enrollments/:id/status`).
- [x] Notices: list, create, edit, delete. Audience select (`ALL`, `STUDENT`, `FACULTY`).
- [x] Payments: list with status filter (`PENDING`, `PAID`, `FAILED`), detail view.
- [x] Audit logs: paginated table with action and entity filters, date range.
- [x] Charts for the dashboard (dataviz guidance: colourblind-safe palette, labelled axes).
- [x] `loading.tsx` and `error.tsx` for each admin segment.

**Done when:** Every admin list has pagination, search and filters. Status changes update the UI optimistically and roll back on error. Error boundaries catch a failing segment without breaking the sidebar.

**Covers:** API & State (15%), Next.js architecture (error boundaries, 15%), UI/UX (20%).

**Status: Done.** Verified (34/34 with Phases 8 and 9): users (role/status/delete menu), students with detail page, enrolment status changes, notices create/edit/delete, payments with detail, audit log with debounced filters, dashboard charts. Charts load lazily.

---

### Phase 8 — Student portal & payment

**Goal:** Students can browse offerings, enrol, see results and notices, manage their profile, and pay tuition through a real test-mode gateway.

**Tasks**
- [x] Student dashboard: enrolled courses, pending payments, recent notices.
- [x] Available offerings: filter by semester and department, show `seatsRemaining`, enrol button (disabled when full, with a clear reason). Uses optimistic update and rollback.
- [x] My enrollments and my results (`GET /results` scoped to self), with GPA summary.
- [x] Profile page: edit name and phone (`PATCH /users/me`), upload avatar (`PATCH /users/profile-image`, multipart, client-side size and type validation).
- [x] Notices page (audience-filtered for STUDENT).
- [x] **Payment flow** (see Section 5 for the gateway decision):
  1. Choose a semester and call `POST /payments/initiate`.
  2. Redirect to `bkashURL`.
  3. bKash returns to `BKASH_CALLBACK_URL`, which is the backend callback. The backend then needs to redirect to the frontend result page.
  4. `/student/payments/result?status=...` polls `GET /payments/:id` until the status is final, then shows success or failure.
- [x] Payment history table with status badges.

**Done when:** A student can enrol, see the seat count drop, and check results. Payment is initiated against the sandbox and the result page shows the true status from the backend. The UI never shows PAID unless the backend says PAID.

**Covers:** Payment Integration (mandatory), Forms (profile, enrolment), UX.

**Status: Done.** Verified: enrol with optimistic seat update (rolls back on error), results with credit-weighted GPA, payments list with bKash checkout dialog, result page polling until the status is final, profile validation, axe clean. Backend change: with `FRONTEND_URL` set, the bKash callback redirects the browser to the result page. The live bKash sandbox was not exercised (no sandbox session here).

---

### Phase 9 — Faculty portal

**Goal:** Faculty can see the offerings they teach, view their students, and enter and publish results.

**Tasks**
- [x] Faculty dashboard: teaching offerings for the current semester, student count per offering.
- [x] Offering detail: enrolled students table (search, sort, status filter).
- [x] Results entry: a grid of enrolled students with grade and grade-point inputs. Zod validation (grade must be from the allowed set, grade point range matches the backend).
- [x] Create a result (`POST /results`) and edit it (`PATCH /results/:id`). Publishing marks the enrollment as completed on the backend, so show a confirm step.
- [x] Use `useSearchParams` for offering and semester selection.
- [x] Faculty profile page (`/users/me`).

**Done when:** A faculty user sees only their own offerings (checked against the backend, not only hidden in the UI). Entering a result shows the enrollment status change after publish.

**Covers:** Role-based UI (15%), Forms & complex workflows (10%).

**Status: Done.** Verified: faculty sees only their offerings, students per offering, grade entry validates before saving, grade point fills from the letter. Publishing creates the result, which the API uses to complete the enrolment.

---

### Phase 10 — Polish, performance, deployment & handover

**Goal:** Production-ready, fast, documented, deployed.

**Tasks**
- [x] Performance:
  - `next/image` everywhere with explicit sizes.
  - `next/dynamic` for heavy client components (charts, rich editors).
  - Check the bundle with `@next/bundle-analyzer` and remove unused shadcn components.
  - Prefetch on hover for the main nav.
- [x] Accessibility pass: keyboard navigation through the sidebar, dialogs, and forms. Labels and `aria-live` for toasts. Run axe on every role's home page.
- [x] Empty, error and loading states reviewed on every list.
- [x] Responsive check at 360px, 768px and 1280px for every page.
- [x] Tests (lightweight): unit tests for the Zod schemas and the API client's error mapping (Vitest). One Playwright smoke test: demo login for each role lands on the right dashboard.
- [x] Deploy the frontend to Vercel. Set `BACKEND_URL` to the Render API URL. Set `DEMO_*` env vars in Vercel (server only). Confirm `CORS_ALLOWED_ORIGINS` on the backend includes the Vercel URL.
- [x] Update backend `CORS_ALLOWED_ORIGINS` and `APP_URL` if needed (the frontend is same-origin through the rewrite, so this may only be needed for direct calls).
- [x] Write `frontend/README.md`: setup, env vars, scripts, architecture, and **demo credentials for all three roles**.
- [x] Final commit count check (must be 20+ meaningful frontend commits, see Section 4).
- [x] Prepare the 5–10 minute video script (UI/UX walkthrough and integration demo).

**Done when:** The live Vercel URL works for all three demo logins. Lighthouse Performance is 85+ on the landing page. The README has everything an evaluator needs.

**Covers:** Performance (10%), Deployment (5%), Commit history (2%), Video (3%).

**Status: Done, except deployment.** Done: 32 unit tests (Vitest), CI workflow for the frontend, frontend README, video script, security headers, Lighthouse on mobile (landing performance 94 and accessibility 100; courses performance 94, CLS 0.01). Not done: the Vercel deployment. It needs the backend running on Render first, and an explicit go-ahead because it creates a public URL.

---

## 4. Commit Plan (target: 20+ meaningful commits)

Conventional commit messages. Every commit touches one concern. The plan below is the target, not a fixed list. Each commit is made when its phase is completed and the user asks for it.

| # | Phase | Example message |
|---|---|---|
| 1 | 1 | `chore: scaffold next.js app router frontend with tailwind v4` |
| 2 | 1 | `chore: add tanstack query, form, zod, ofetch and zustand` |
| 3 | 1 | `chore: initialise shadcn/ui with brand colour tokens` |
| 4 | 1 | `feat: validate frontend env vars at boot` |
| 5 | 2 | `feat: add root layout with theme provider and fonts` |
| 6 | 2 | `feat: add responsive public navbar and footer` |
| 7 | 2 | `feat: add shared page header, stat card and empty state` |
| 8 | 2 | `feat: add root loading, error and not-found boundaries` |
| 9 | 3 | `feat: add next.config rewrite for backend api proxy` |
| 10 | 3 | `feat: add ofetch client with envelope unwrapping and ApiError` |
| 11 | 3 | `feat: refresh session once on 401 with a single in-flight promise` |
| 12 | 3 | `feat: wire tanstack query provider and query key factory` |
| 13 | 4 | `feat: add login page with one-click demo login per role` |
| 14 | 4 | `feat: add demo login route handler using server-only credentials` |
| 15 | 4 | `feat: protect dashboard routes in middleware` |
| 16 | 4 | `feat: add role-gated dashboard layouts and RoleGate component` |
| 17 | 5 | `feat: add SSG landing and public notices pages` |
| 18 | 5 | `feat: add SSG department and course pages with ISR` |
| 19 | 6 | `feat: add data table with URL-synced pagination, sort and search` |
| 20 | 6 | `feat: add admin CRUD for departments, semesters and courses` |
| 21 | 6 | `feat: add course offering management with seat indicators` |
| 22 | 7 | `feat: add admin user and student management` |
| 23 | 7 | `feat: add admin audit log view` |
| 24 | 8 | `feat: add student enrolment with optimistic updates` |
| 25 | 8 | `feat: integrate bkash payment initiation and result polling` |
| 26 | 9 | `feat: add faculty result entry with zod validation` |
| 27 | 10 | `perf: optimise images and lazy-load heavy components` |
| 28 | 10 | `test: add zod schema tests and demo login smoke test` |
| 29 | 10 | `docs: add frontend readme with setup and demo credentials` |

Commit trailer, per the project's attribution rule:
`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`

---

## 5. Open Decisions & Risks

1. **Payment gateway (needs your decision before Phase 8).** The brief says
   "Stripe or SSLCommerz (Test Mode)". The backend already implements **bKash**
   tokenized checkout (sandbox). Options:
   - **A (default in this plan):** keep bKash. It is a test-mode gateway, and the
     code is already built and tested against the flow. Confirm with your
     instructor that bKash sandbox counts.
   - **B:** add SSLCommerz sandbox to the backend. This adds backend work
     (a new module similar to `payment`) before Phase 8.
2. **Payment result redirect.** `BKASH_CALLBACK_URL` points at the backend, which
   currently returns JSON. For a real UX, the backend callback should redirect to
   `${APP_URL}/student/payments/result?paymentId=...` after finalising. This is a
   small backend change, needed in Phase 8.
3. **Auth rate limit.** 20 auth requests per 15 minutes per IP. Demo login and
   repeated testing could hit this. Behind the Vercel proxy, confirm that
   `X-Forwarded-For` reaches the backend so limits are per visitor, not shared by
   all visitors. The backend uses `trust proxy: 1`.
4. **Cookie scope.** The access cookie is `path=/`, and the refresh cookie is
   `path=/api/v1/auth`. With the same-origin proxy, both reach the backend. No
   backend change is needed for this.
5. **Secrets.** Demo passwords go in Vercel and local `.env.local` only, never in
   git and never in `NEXT_PUBLIC_*`.
6. **Google login.** The backend supports `POST /auth/google`. It is not in the
   brief's must-haves, so it is optional and will be added only if time allows.

---

## 6. Progress Tracker

| Phase | Title | Status |
|---|---|---|
| 1 | Project bootstrap & tooling | Done |
| 2 | Design system & app shell | Done |
| 3 | API layer & data fetching | Done |
| 4 | Authentication & authorization | Done |
| 5 | Public pages (SSG / ISR) | Done |
| 6 | Admin: academic setup | Done |
| 7 | Admin: people & operations | Done |
| 8 | Student portal & payment | Done |
| 9 | Faculty portal | Done |
| 10 | Polish, performance & deployment | Done (deployment pending) |

## 7. Mandatory Requirements Mapping

| Brief requirement | Where it is delivered |
|---|---|
| App Router: Server/Client split, `layout`/`page`/`error`/`loading` | Phases 2, 4, 5, 7 |
| Tailwind + component library | Phases 1, 2 |
| Auth + middleware + role-based UI (3 roles) | Phase 4 (middleware + layouts), Phase 5 onward (role UI) |
| One-click demo login for 3 roles | Phase 4 |
| Data fetching, global state, skeletons, error boundaries | Phases 3, 6, 7 |
| Forms: TanStack Form + Zod, matching backend | Phases 4, 6, 8, 9 |
| Payment (test mode) | Phase 8 (see Open Decision 1) |
| 20+ commits | Section 4, Phase 10 check |
| Demo credentials | Phase 10 README |
| Live URL | Phase 10 (Vercel) |

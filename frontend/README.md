# University Management System — Frontend

The web app for students, faculty and administrators. It is built with Next.js
(App Router), React 19, Tailwind CSS v4, shadcn/ui, TanStack Query and Form, Zod
and ofetch. It talks to the Express API in `../backend`.

## Features

| Area | What it covers |
|---|---|
| Public site | Landing page, departments, course catalogue (search and filter in the URL), faculty directory, notices. Statically generated with ISR. |
| Authentication | Email and password login, student self-registration, one-click demo login for each role, route protection, automatic session refresh. |
| Administration | Dashboard with live figures and charts, departments, semesters, courses, faculty, offerings (with seat tracking), users, students, enrolments, notices, payments, audit log. |
| Student | Course enrolment with optimistic seat updates, enrolments, results and GPA, tuition payment through bKash, notices, profile and photo. |
| Faculty | Assigned offerings, enrolled students, grade entry and publishing, notices, profile. |

## Requirements

- Node.js 22 or later (the project is developed on Node 24)
- The backend running (see `../backend/README.md`), with the seeded demo accounts

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | public | This site's origin, for metadata, the sitemap and robots. |
| `BACKEND_URL` | server | Express API origin, e.g. `http://localhost:5000` or the Render URL. |
| `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` | server | Admin demo account. Must exist in the backend database. |
| `DEMO_FACULTY_EMAIL`, `DEMO_FACULTY_PASSWORD` | server | Faculty demo account. |
| `DEMO_STUDENT_EMAIL`, `DEMO_STUDENT_PASSWORD` | server | Student demo account. |

Server-only values are never prefixed with `NEXT_PUBLIC_`, and `src/lib/env.server.ts`
imports `server-only`, so a client component that imports it fails the build. The app
validates all variables at boot and stops with a readable message if one is missing.

### Demo accounts

The backend's `npm run seed` creates three accounts (`TESTER_ADMIN_*`, `TESTER_FACULTY_*`,
`TESTER_STUDENT_*` in the backend `.env`). Copy the same emails and passwords into the
`DEMO_*` variables above. Passwords are never committed to the repository.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server with Turbopack |
| `npm run build` | Production build. Public pages are generated, so the API must be reachable. |
| `npm run start` | Serves the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js rules, including React Compiler checks) |
| `npm test` | Unit tests (Vitest): auth helpers, API client, validation rules, GPA, client IP |

## Architecture

```
src/
  app/
    (public)/          SSG and ISR pages: landing, departments, courses, faculties, notices
    (auth)/            login, register (split layout)
    (dashboard)/       signed-in area: layout with header, plus role-gated admin/, faculty/, student/
    api/demo-login/    route handler for the one-click demo login (server-side credentials)
    sitemap.ts, robots.ts, not-found.tsx, global-error.tsx
  proxy.ts             session guard and token rotation; forwards the client IP to the API
  components/          shared UI (layout, shared, forms, admin, student, faculty, catalog)
  features/            manager screens for the admin area (one folder per resource)
  hooks/               useApiQuery, useApiMutation, useListState, useUrlParam, options
  lib/
    api/               browser client, server client, typed endpoints, query keys, errors
    auth/              roles and routes, session lookup, token freshness, nav
    validations/       Zod schemas that mirror the backend validation files
    academics/         GPA
    net/               visitor IP helper
  stores/              Zustand (client-only UI state)
  types/               API envelope and entity types
```

### Key decisions

- **Server Components by default.** Client components are used where there is state,
  an effect or a browser API: forms, tables with URL state, charts, the mobile menu.
- **Rendering.** Public pages are static with ISR (`revalidate` 60 to 300 seconds).
  Personal pages are dynamic and never cached.
- **Same-origin API.** The browser calls `/api/v1/*` on this site, and `next.config.ts`
  rewrites it to Express. The auth cookies are first-party, so no CORS setup is needed in
  the browser.
- **Sessions.** The access token is an httpOnly cookie. `src/proxy.ts` checks its expiry
  and rotates an expired session with the refresh token before the page renders, so no
  redirect loop is possible. Concurrent 401 responses share one refresh request.
- **Role checks in three places.** The proxy (signed-in or not), the role layouts (which
  role may see the area), and the API (the real authority). Hiding a link is UI only.
- **Forms.** TanStack Form with Zod schemas that mirror the backend rules. Field errors
  appear next to the input. Errors that come back from the API are shown in an alert.
- **Lists.** Pagination, sorting, search and filters live in the URL, so they survive a
  refresh and can be shared.
- **Money.** Amounts come from the server. The client never chooses a fee. A payment
  becomes PAID only after the API has checked it with bKash, and the result page polls
  that status.

## Deployment (Vercel)

1. Import the repository into Vercel and set **Root Directory** to `frontend`.
2. Framework preset: Next.js. Build command: `npm run build`.
3. Set environment variables (Production and Preview):
   - `NEXT_PUBLIC_APP_URL` = the Vercel URL
   - `BACKEND_URL` = the Render API URL
   - `DEMO_*` = the demo account credentials
4. On the backend, set `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL` to the Vercel URL, and
   redeploy. `FRONTEND_URL` sends the browser to the payment result page after bKash.
5. The build fetches public data from the API, so the API must be running and reachable
   when Vercel builds the site.

## Known limitations

- Lists load up to 100 options for dropdowns. A larger catalogue needs a searchable picker.
- Google sign-in is not in the frontend.
- The frontend does not run a browser test suite in CI. The end-to-end checks used during
  the build were run against a local stack and are not part of the repository.

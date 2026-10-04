# University Management System

A monorepo with two apps:

| Folder | What it is | Stack |
|---|---|---|
| [`backend/`](./backend) | REST API for administration, academics, enrolment, results, notices and payments | Node.js, TypeScript, Express 5, PostgreSQL, Prisma 7, Redis |
| [`frontend/`](./frontend) | Web app for Admins, Faculty and Students | Next.js (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query and Form, Zod |

Each folder is a self-contained project with its own `package.json`, and each
has its own README with setup steps and environment variables:

- Backend setup, API docs and deployment: [`backend/README.md`](./backend/README.md)
- Frontend plan and phase tracker: [`frontend.md`](./frontend.md)

## Layout

```
.
├── backend/            Express API, Prisma schema and migrations, Dockerfile, Vercel entry
├── frontend/           Next.js app
├── frontend.md         Frontend build plan (10 phases)
├── render.yaml         Render blueprint (builds backend/Dockerfile)
└── .github/workflows/  CI for the backend
```

## Getting started

```bash
# Backend (API on http://localhost:5000)
cd backend && npm install && npm run dev

# Frontend (app on http://localhost:3000), in a second terminal
cd frontend && npm install && npm run dev
```

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
`frontend/.env.local`, then fill in the values. Neither file is committed.

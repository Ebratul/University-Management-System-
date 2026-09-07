# University Management System

Backend application using PostgreSQL and Prisma 6.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to a PostgreSQL connection string.
3. Install dependencies:

```bash
npm install
```

4. Generate the Prisma client:

```bash
npm run prisma:generate
```

5. Create and apply a development migration:

```bash
npm run prisma:migrate -- --name init
```

## Useful commands

```bash
npm run dev
npm run build
npm run prisma:deploy
npm run prisma:studio
```

The Prisma schema is located at `prisma/schema.prisma`. The application uses
`@prisma/adapter-pg` to connect Prisma Client to PostgreSQL.
# University-Management-System-

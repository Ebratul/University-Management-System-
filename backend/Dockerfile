# --- deps: install once, cached across build/prod stages ---
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: package.json's postinstall runs `prisma generate`, which
# needs DATABASE_URL (prisma.config.ts resolves it eagerly) and isn't set
# here. The build stage below generates explicitly, with a placeholder URL,
# after this layer's node_modules are copied in — so skipping it here is a
# no-op, not a missing step.
RUN npm ci --ignore-scripts

# --- build: compile TypeScript and generate the Prisma client ---
FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `prisma generate` never opens a DB connection, but prisma.config.ts
# resolves DATABASE_URL eagerly via env() while loading the config file, so
# it throws if the var is unset — no .env is (or should be) available at
# build time. This placeholder is never used to actually connect; it's
# discarded when this stage ends (ENV doesn't carry across FROM stages).
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db"
RUN npx prisma generate
RUN npm run build

# --- production: slim runtime image, no dev dependencies, no source ---
FROM node:24-slim AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# --ignore-scripts: same postinstall as above, and this stage has no prisma
# CLI at all (it's a devDependency, excluded by --omit=dev) — the generated
# client below is copied in from the build stage instead of regenerated here.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
# Migrations are a deploy step (`npm run migrate:deploy`), run against this
# image's build stage or in CI — not baked into the runtime container, which
# intentionally has no prisma CLI or schema files, just the generated client.

RUN groupadd --system nodejs && useradd --system --gid nodejs nodejs
USER nodejs

EXPOSE 5000
CMD ["node", "dist/server.js"]

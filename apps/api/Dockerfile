# syntax=docker/dockerfile:1.7
# Build context: REPO ROOT (so prisma schema is reachable).
# Build with: docker compose build api
#   or:      docker build -f apps/api/Dockerfile -t leetrank-api .

# --- Build stage ---
# node:20-slim (Debian) instead of alpine: Prisma's musl-openssl-3 engine
# detection is unreliable on Alpine 3.18+ (libssl.so.1.1 removed, the
# legacy `linux-musl` engine still tries to dlopen it). Debian slim ships
# OpenSSL 3 that Prisma natively recognises as `debian-openssl-3.0.x`.
FROM node:26-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY apps/api/package.json apps/api/tsconfig.json ./
COPY apps/api/src ./src
COPY prisma ./prisma

# Install with optional deps so any native bindings (e.g. prisma engines)
# land. --omit=optional skipped them and `prisma generate` failed.
# Scope tightening (P-01): apps/api has its own package.json with the
# minimal hono + prisma + zod surface — DO NOT install the root workspace
# (Next, Monaco, Playwright, Vitest) here. Build deps include `prisma`
# CLI + `typescript` + `tsx`; runtime stage prunes them with
# `npm prune --omit=dev`. See ADR 0028.
# Migrating to `pnpm install --frozen-lockfile` is tracked in DX audit
# F-21/F-22.
RUN npm install --no-audit --no-fund \
 && npx prisma generate \
 && npx tsc \
 && npm prune --omit=dev

# --- Runtime stage ---
FROM node:26-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*

# Drop root for the runtime process.
RUN groupadd --system leetrank && useradd --system --gid leetrank leetrank

WORKDIR /app

# Pull only the production deps + the built dist + Prisma assets.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

USER leetrank

EXPOSE 4000

ENV NODE_ENV=production \
    API_PORT=4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]

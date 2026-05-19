# syntax=docker/dockerfile:1.7
# Build context: REPO ROOT (so prisma schema is reachable).
# Build with: docker compose build api
#   or:      docker build -f apps/api/Dockerfile -t leetrank-api .

# --- Build stage ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/api/package.json apps/api/tsconfig.json ./
COPY apps/api/src ./src
COPY prisma ./prisma

# Install with optional deps so any native bindings (e.g. prisma engines)
# land. --omit=optional skipped them and `prisma generate` failed.
# Migrating to `pnpm install --frozen-lockfile` is tracked in DX audit
# F-21/F-22.
RUN npm install --no-audit --no-fund \
 && npx prisma generate \
 && npx tsc

# --- Runtime stage ---
FROM node:20-alpine AS runtime

# Drop root for the runtime process.
RUN addgroup -S leetrank && adduser -S leetrank -G leetrank

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

# syntax=docker/dockerfile:1.7
# Build context: REPO ROOT (so prisma schema is reachable).

# --- Build stage ---
# node:20-slim (Debian) — see apps/api/Dockerfile for why we left Alpine.
FROM node:26-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY apps/auth/package.json apps/auth/tsconfig.json ./
COPY apps/auth/src ./src
COPY prisma ./prisma

RUN npm install --no-audit --no-fund \
 && npx prisma generate \
 && npx tsc

# --- Runtime stage ---
FROM node:26-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates wget \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system leetrank && useradd --system --gid leetrank leetrank

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

USER leetrank

EXPOSE 4001

ENV NODE_ENV=production \
    API_PORT=4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4001/healthz || exit 1

CMD ["node", "dist/server.js"]

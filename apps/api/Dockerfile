# syntax=docker/dockerfile:1.7

# --- Build stage ---
FROM node:24-alpine AS builder

WORKDIR /app

# pnpm via corepack — keeps install reproducible without a global add.
RUN corepack enable

COPY package.json tsconfig.json ./
COPY src ./src

RUN npm install --omit=optional --no-package-lock \
 && npx tsc

# --- Runtime stage ---
FROM node:24-alpine AS runtime

# Drop root for the runtime process.
RUN addgroup -S leetrank && adduser -S leetrank -G leetrank

WORKDIR /app

# Pull only the production deps + the built dist.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER leetrank

EXPOSE 4000

ENV NODE_ENV=production \
    API_PORT=4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# pnpm-lock.yaml is the canonical workspace lockfile; package-lock.json is
# gitignored. Use `npm install` here (not `npm ci`) so the build doesn't
# require a lockfile present in the build context. Migrating to
# `pnpm install --frozen-lockfile` is tracked in the DX audit (F-21/F-22).
COPY package.json ./
# Install with optional deps so native bindings (lightningcss-linux-x64-musl
# for Tailwind v4, sharp, etc.) land. --omit=optional skipped them and
# Turbopack build fails to find lightningcss at compile time.
RUN npm install --no-audit --no-fund

# Stage 2: Build the application
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js. Routes import lib/auth which validates JWT_SECRET at module
# load — Next collects page data during build and trips the validation, so
# we feed a build-time placeholder. The runtime image gets the real secret
# from the orchestrator env.
ENV NEXT_TELEMETRY_DISABLED=1 \
    JWT_SECRET=build-time-placeholder-not-a-real-secret-32-chars \
    DATABASE_URL=postgresql://build:build@build:5432/build?schema=public
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema and generated client for runtime
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

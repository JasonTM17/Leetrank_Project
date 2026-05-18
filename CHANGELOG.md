# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 30+ new public API routes covering search, trending, random, statistics,
  contest lifecycle (join/leave/active/upcoming/me/leaderboard/entries),
  discussion editing/upvotes/per-comment moderation, profile aggregates
  (submissions/discussions/bookmarks/stats heatmap), admin user/contest/
  discussion moderation paths, judge health proxy, OpenAPI spec viewer.
- Bookmarks domain: `Bookmark` Prisma model with composite unique
  (userId,problemId), toggle API, BookmarkButton with optimistic UI,
  /dashboard/bookmarks list page.
- Profile + settings: /users/[username] public profile, /dashboard/settings
  with avatar/bio editor, /dashboard/settings/password change page.
- Site polish: /forbidden 403 page, /api-docs Swagger UI, /robots.txt and
  /sitemap.xml from app router, error.tsx + loading.tsx for /dashboard,
  /problems, /contests, /leaderboard, /admin.
- Theme toggle (light/system/dark) wired into the navbar.
- Dialog primitive on the native <dialog> element, Avatar with gradient
  initial fallback, expanded Skeleton variants.
- Internal libs: `src/lib/strings.ts` (slugify/truncate/pluralize),
  `src/lib/rate-limit.ts` (in-process fixed-window limiter, ready to swap
  for Redis), `src/lib/metrics.ts` HTTP counter + `src/lib/logger.ts`
  child-logger pattern.
- Postgres + Redis services in `docker-compose.yml`. Compose now also
  bundles Caddy 2 (TLS, rate-limit, security headers), Prometheus, Grafana
  with auto-provisioned Prometheus datasource, plus postgres/redis
  exporters. Single `docker compose up` boots the full stack.
- Docker Hub publish workflow: matrix build of app + judge images, multi-arch
  amd64+arm64, GHA-cached layers, SBOM and provenance attestations.
- Language manifest declaring 15 languages: Python, JavaScript, TypeScript,
  Ruby, PHP, Bash, Go, Rust, C, C++, Java, Kotlin, C#, Swift, SQL.
- `prisma/seed-bulk.ts` deterministically generates 10,000 problems and
  1,000 contests for stress / scaling tests.
- `/api/metrics` Prometheus exposition with uptime, user/problem/submission
  counts, and per-status HTTP request counters.
- `/api/health` endpoint that probes the database and judge service in
  parallel and reports per-service latency, uptime, and overall status.
- Concurrency scheduler in the Go judge with a global + per-IP semaphore
  and bounded wait queue. Tunable via `JUDGE_GLOBAL_MAX`, `JUDGE_PER_IP_MAX`,
  and `JUDGE_QUEUE_WAIT_MS`.
- Hot-path indexes on `Problem`, `Submission`, `Contest`, and `ContestEntry`
  Prisma models.
- Zod validation for every admin POST/PUT route (problems, contests, role,
  status) including a strict ISO 8601 + `endTime > startTime` check.
- 10 ADRs in `docs/adr/` documenting major architectural decisions.
- OpenAPI 3.1 spec at `docs/openapi.yaml` (~800 lines) served at
  `/api/openapi` and rendered via Swagger UI at `/api-docs`.
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, GitHub issue + PR templates.
- 377 tests across 76 files (up from the initial 18). Every API route has
  integration coverage; pure-function libs have boundary + edge tests.
- Toast notification system, EmptyState primitive, design-token overhaul
  with motion utilities (fade-in-up, pulse-soft, shimmer) and helpers
  (.glass, .gradient-text, .bg-grid, .bg-radial-fade, .scrollbar-thin).
- Skip-link, expanded metadata, and reduced-motion media query in the
  root layout.
- DiscussionsPanel on the problem detail page, full thread page at
  /discussions/[id].
- Language manifest expanded from 15 to **34 languages**: added Lua, Perl,
  Elixir, D, Pascal, Nim, Fortran, Scala, Groovy, Clojure, Haskell, OCaml,
  Racket, Common Lisp (SBCL), Erlang, F#, R, Julia, Tcl, AWK. Each entry
  carries `kind`, `category`, `compileCmd`/`runCmd`, and Monaco language ID.
  `src/lib/languages.ts` mirrors the manifest for the frontend dropdown.
- `apps/auth` scaffold: standalone Hono auth service (register, login, logout,
  /me) extracted from the web app as Phase 1 of ADR 0016. Not yet wired into
  production traffic.
- `packages/api-contracts`: shared Zod schemas and TypeScript types for every
  `apps/api` endpoint. Frontend imports types from this package; no more
  hand-rolled interfaces.
- `packages/auth-verify`: shared JWT verification middleware consumed by both
  `apps/api` and `apps/auth`. Single source of truth for cookie parsing and
  token validation.
- Chatbot scaffold (`apps/chatbot` / n8n integration per ADR 0015): in-platform
  assistant wired to the `ChatMessage` Prisma model. Stores `userId`,
  `problemId`/`contestId` context, role, and content.
- Multi-service Docker compose: `apps/api`, `apps/auth`, `apps/web`, and
  `judge-service` each have independent Dockerfiles. `docker-compose.yml`
  boots all four plus Postgres, Redis, Caddy, Prometheus, and Grafana with
  a single `docker compose up`.
- Test suite expanded to **461 tests across 12 Vitest configs** (up from 377
  across 76 files). New coverage: `apps/api` route integration tests,
  `packages/api-contracts` schema round-trips, `packages/auth-verify`
  middleware unit tests.
- Audit deliverables committed to `docs/`: security audit, production-readiness
  audit (F-series items), DX audit, UI/UX audit, microservices migration plan.
- Per-service runbooks in `docs/runbooks/` covering `apps/api`, `apps/auth`,
  `apps/web`, and `judge-service`. Disaster-recovery runbook at
  `docs/runbooks/disaster-recovery.md`.
- Dependabot config (`.github/dependabot.yml`) for npm and GitHub Actions
  ecosystems with weekly cadence.
- Prettier config and `.gitattributes` for consistent line endings across
  platforms.

### Changed
- Prisma provider switched from SQLite to PostgreSQL; schema bodies are
  unchanged. Postgres becomes the canonical Prisma datasource for both
  dev and prod.
- Landing page rebuilt around the new design tokens with grid backdrop,
  gradient text, glass CTA, and a stats row showing real platform numbers.
- `src/services/judge.ts` now POSTs to the Go judge over HTTP instead of
  simulating execution in TypeScript. Connectivity failures surface as a
  typed `JudgeUnavailableError` and are mapped to HTTP 503 by the API.
- Container health checks point to `/api/health` instead of `/api/auth/me`.
- `useAuth.logout` calls `/api/auth/logout` so the httpOnly session cookie
  is actually cleared.
- `/api/leaderboard` now accepts `page` and `limit` query params (defaults
  50, max 100), dedup-aware via groupBy(userId, problemId).
- Footer copyright year is computed from `new Date()`.
- Middleware redirects non-admins to /forbidden instead of silently to /.
- Next config: `output:'standalone'` for tiny runtime images,
  `reactStrictMode`, `poweredByHeader:false`, header floor on every route.
- CI now runs four parallel jobs (web, audit, judge with race detector,
  docker buildx) with a concurrency group that cancels superseded pushes.

### Security
- JWT secret loading throws in production when unset or shorter than 16
  characters, instead of silently falling back to a hardcoded string.
- `docker-compose.yml` requires `JWT_SECRET` via shell expansion so the
  stack refuses to boot without a real secret.
- Caddy reverse proxy enforces HSTS, X-Content-Type-Options, frame-deny,
  referrer policy, and a 30 req/min/IP rate limit on auth + admin endpoints
  in addition to the in-app limiter.
- Self-demotion guard on /api/admin/users/[id]/role + self-deletion guard
  on /api/admin/users/[id] DELETE prevent the last-admin lockout footgun.
- Cross-thread guard on discussion comment delete — a commentId is checked
  against its parent discussionId so a malicious caller can't delete a
  comment via someone else's thread URL.
- Submission code is private to the author + admins; public submission
  endpoints expose metadata only.
- Replaced `dangerouslySetInnerHTML` in the problem description with a
  paragraph-per-line render to remove a latent XSS sink.

### Fixed
- `cn()` test: aligned the assertion with twMerge's conflict-resolution
  behaviour (last `text-*` wins).
- `jsonRequest` test helper: spread order was wrong, init.headers
  could clobber Content-Type. Reordered.
- Lint: wrapped effect bodies in eslint-disable blocks instead of
  single-line directives so the disable covers the .then/.finally chains.
- Native bindings (rollup, swc on Windows) excluded from package.json so
  cross-platform CI doesn't break.

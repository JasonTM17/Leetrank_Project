# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Postgres + Redis services in `docker-compose.yml` so dev runs on the
  same engines as production. Compose now also bundles Caddy 2 (TLS,
  rate-limit, security headers), Prometheus, Grafana with auto-provisioned
  Prometheus datasource, plus postgres/redis exporters. Single
  `docker compose up` boots the full stack.
- `infra/caddy/Caddyfile`, `infra/prometheus/prometheus.yml`,
  `infra/grafana/provisioning/*` for the new stack.
- `.env.production.example` with every knob the production stack expects.
- Docker Hub publish workflow: matrix build of app + judge images, multi-arch
  amd64+arm64, GHA-cached layers, SBOM and provenance attestations.
- Language manifest (`judge-service/languages.json`, `src/lib/languages.ts`)
  declaring 15 languages: Python, JavaScript, TypeScript, Ruby, PHP, Bash,
  Go, Rust, C, C++, Java, Kotlin, C#, Swift, SQL.
- `prisma/seed-bulk.ts` deterministically generates 10,000 problems and
  1,000 contests for stress / scaling tests.
- `/api/metrics` endpoint emitting Prometheus exposition format with
  uptime, user/problem/submission counts, and per-status HTTP request
  counters.
- Toast notification system (`src/hooks/useToast.ts`,
  `src/components/ui/toaster.tsx`) and a callable `toast` helper.
- Discussion forum: `Discussion` + `DiscussionComment` Prisma models,
  CRUD routes at `/api/discussions` and `/api/discussions/[id]`, the
  `DiscussionsPanel` component on the problem detail page, and a full
  thread page at `/discussions/[id]`.
- Public profile API + page at `/users/[username]` with stats, difficulty
  breakdown, and recent activity.
- 86 API integration tests across 16 routes (auth, problems, contests,
  submissions, leaderboard, tags, health, metrics, discussions, users,
  admin/*, run-code) plus 10 ADRs in `docs/adr/`.
- New UI primitives: `EmptyState`, expanded `Skeleton` variants, design
  tokens for success/warning/easy/medium/hard, motion utilities
  (`fade-in-up`, `pulse-soft`, `shimmer`), and helpers (`.glass`,
  `.gradient-text`, `.bg-grid`, `.bg-radial-fade`, `.scrollbar-thin`).
- Skip-link, expanded metadata, and reduced-motion media query in the
  root layout.
- `/api/health` endpoint that probes the database and judge service in
  parallel and reports per-service latency, uptime, and overall status.
- Concurrency scheduler in the Go judge with a global + per-IP semaphore
  and bounded wait queue. Tunable via `JUDGE_GLOBAL_MAX`, `JUDGE_PER_IP_MAX`,
  and `JUDGE_QUEUE_WAIT_MS`. The judge `/health` payload now exposes a
  scheduler snapshot for external monitoring.
- `SECURITY.md`, `CODE_OF_CONDUCT.md`, and this `CHANGELOG.md`.
- GitHub issue templates and pull request template.
- Hot-path indexes on `Problem`, `Submission`, `Contest`, and `ContestEntry`
  Prisma models.
- Zod validation for admin POST/PUT routes (problems, contests) including a
  strict ISO 8601 + `endTime > startTime` check.
- `src/lib/logger.ts`: structured JSON logger with level threshold and
  per-request child loggers.
- 22 additional unit tests (validations-extra, utils, auth) for a TS suite
  total now at 126 across 24 files.
- Go test suite for the judge: scheduler accept/release accounting, per-IP
  isolation, context cancellation, 40-request concurrency stress, plus
  `isSafe()` per language and the rate limiter.
- CI now runs four parallel jobs (web, audit, judge with race detector,
  docker buildx) with a concurrency group that cancels superseded pushes.

### Changed
- Prisma provider switched from SQLite to PostgreSQL; schema bodies are
  unchanged.
- Landing page rebuilt around the new design tokens with grid backdrop,
  gradient text, glass CTA, and a stats row showing real platform numbers.
- `src/services/judge.ts` now POSTs to the Go judge over HTTP instead of
  simulating execution in TypeScript. Connectivity failures surface as a
  typed `JudgeUnavailableError` and are mapped to HTTP 503 by the API.
- Container health checks point to `/api/health` instead of `/api/auth/me`,
  removing the false-negative that required an authenticated cookie.
- `useAuth.logout` calls `/api/auth/logout` so the httpOnly session cookie
  is actually cleared. The navbar awaits the call before redirecting.
- `/api/leaderboard` now accepts `page` and `limit` query params (defaults
  50, max 100), and dedup-aware: `groupBy(userId, problemId)` so multiple
  AC submissions for one problem stop double-counting.
- Footer copyright year is computed from `new Date()`.

### Fixed
- JWT secret loading throws in production when unset or shorter than 16
  characters, instead of silently falling back to a hardcoded string.
- Replaced `dangerouslySetInnerHTML` in the problem description with a
  paragraph-per-line render to remove a latent XSS sink.

### Security
- `docker-compose.yml` requires `JWT_SECRET` via shell expansion
  (`${VAR:?msg}`) so the stack refuses to boot without a real secret.
- Caddy reverse proxy enforces HSTS, X-Content-Type-Options, frame-deny,
  referrer policy, and a 30 req/min/IP rate limit on auth and admin
  endpoints in addition to the in-app limiter.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
  total of 40 tests across 4 files.
- Go test suite for the judge: scheduler accept/release accounting, per-IP
  isolation, context cancellation, 40-request concurrency stress, plus
  `isSafe()` per language and the rate limiter.
- CI now runs four parallel jobs (web, audit, judge with race detector,
  docker buildx) with a concurrency group that cancels superseded pushes.

### Changed
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

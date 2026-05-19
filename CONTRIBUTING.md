# Contributing to LeetRank

🌐 **English** · [Tiếng Việt](CONTRIBUTING.vi.md)

Thanks for your interest. This guide covers the workflow we use day-to-day — branch naming, commit format, dev setup, PRs, and review.

We follow [Conventional Commits](https://www.conventionalcommits.org/) and one-feature-per-PR. Read this once before your first PR; you'll save a review round.

## Code of conduct

Participation in this project is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report unacceptable behaviour to **jasonbmt06@gmail.com**.

## Dev setup

### With Docker (recommended)

Requirements: Docker Desktop 4.30+ or Docker Engine 24+, Compose v2.

```bash
git clone https://github.com/JasonTM17/Leetrank_Project.git
cd Leetrank_Project
cp .env.example .env

# Boot the full stack.
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# Tail the web service.
docker compose logs -f app
```

The stack exposes:

- http://localhost:3000 — Web (Next.js)
- http://localhost:4000 — Read API
- http://localhost:4011 — Auth (Go)
- http://localhost:4012 — Submissions (Go)
- http://localhost:4013 — Problems (Go)
- http://localhost:9090 — Judge service

### Native

Requirements: Node 20, pnpm 9, Go 1.22, PostgreSQL 16, Redis 7.

```bash
pnpm install
cp .env.example .env

pnpm db:push     # apply Prisma schema
pnpm db:seed     # seed problems, tags, demo accounts
pnpm dev         # http://localhost:3000
```

Demo accounts: `admin@leetrank.local` / `Admin123!` and `demo@leetrank.local` / `Demo123!`.

## Branching model

- `main` is always shippable. CI must be green to merge.
- Branch off `main` for every change.
- Branch names are `<type>/<short-kebab-summary>`, where `<type>` is the same as the commit type below.

Examples:

```
feat/contest-leaderboard-redis
fix/auth-cookie-samesite-strict
docs/judge-runbook
chore/bump-prisma-5.22
```

Long-running migrations (e.g. the Phase 3 backend split) live on a tracked branch, with feature branches merging into it.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Commit messages look like:

```
<type>(<scope>): <subject>

<body>

<footer>
```

`<type>` must be one of:

| Type | Use for |
|------|---------|
| `feat` | New user-visible behaviour |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting; no behavioural change |
| `refactor` | Code change that's neither feature nor fix |
| `perf` | Performance-only change |
| `test` | Adding or fixing tests |
| `build` | Build system, tooling, dependencies |
| `ci` | CI configuration |
| `chore` | Maintenance that doesn't fit elsewhere |

`<scope>` is the area touched: `api`, `auth`, `auth-go`, `web`, `judge`, `submissions-go`, `problems-go`, `prisma`, `ci`, `docs`, etc.

Examples:

```
feat(auth-go): real register/login/me/logout/change-password
fix(ci): npm install (no lockfile) + judge GOFLAGS=-mod=mod
docs(adr): add 0021 rating algorithm (Glicko-2)
```

Subject rules:
- Imperative mood (`add` not `added`).
- No trailing period.
- 72 characters or fewer.

The body explains *why*, not *what* — the diff already tells you what.

### Commit authorship

The repo is single-contributor today. Commits are signed off by `Nguyen Tien Son <jasonbmt06@gmail.com>`. Do **not** add `Co-Authored-By: Claude` (or any AI tooling trailer) to commit messages. If you contribute via PR, your authorship is captured by Git as normal.

## Code style

### TypeScript / JavaScript

- TypeScript strict mode, no implicit `any`.
- Prefer named exports; default exports only when a framework requires it.
- ESLint + Prettier configurations live in the repo. Don't override them locally.
- Match existing import order: standard library → third-party → workspace → local.

### Go

- `gofmt` / `goimports` is non-negotiable; CI rejects unformatted code.
- Standard library before third-party. Group imports.
- Prefer `slog` for logging; never use `fmt.Println` in service code.
- Errors are values: `if err != nil { return fmt.Errorf("operation: %w", err) }`.

### SQL

- Migrations are forward-only. Never edit a merged migration file.
- All schema changes go through Prisma (`prisma/schema.prisma`) for the TS side; Go services own their own SQL migrations under `services/<svc>/internal/migrations/`.

## Tests

| Layer | Command |
|-------|---------|
| Web unit + component | `pnpm test` |
| Web e2e (Playwright) | `pnpm test:e2e` |
| API workspace | `pnpm --filter apps/api test` |
| Auth (Go identity) | `cd services/auth-go && go test ./...` |
| Go services | `cd services/<svc> && go test ./...` |
| Judge | `cd judge-service && go test ./...` |

Add a test for every behavioural change. If the test framework doesn't exist yet for your area, set one up — don't ship the change without coverage.

## OpenAPI specs

The contract between services lives in:

- `apps/api/openapi.yaml`
- `services/auth-go/openapi.yaml`
- `docs/openapi.yaml` (legacy combined)

Lint with `pnpm openapi:lint` (Redocly). Specs must lint clean before a PR is merged.

## Pull requests

1. Branch off `main`. Keep one feature or fix per PR.
2. Run locally: `pnpm typecheck && pnpm lint && pnpm test` (TS) and `go test ./... && go vet ./...` (Go).
3. Push and open a PR against `main`. Use the template; fill in every section.
4. CI runs `web`, `api`, `judge`, `audit`, and `docker` jobs. All must be green.
5. Address review comments via new commits — we squash on merge, so don't worry about commit hygiene during review.

PR title follows the same Conventional Commits format as a single commit; the merge commit will use it verbatim.

### Review model (solo maintainer)

LeetRank is currently a one-maintainer project, so the `CODEOWNERS` file routes every PR to the sole contributor (`@JasonTM17`). Self-review is intentional, not an oversight: the maintainer opens a PR, lets the full status-check matrix run (`web`, `api`, `judge`, `go-tests`, `audit`, `e2e`, `codeql`, `trivy-fs`), reviews the diff in the GitHub UI, and merges only after CI is green and the codecov gate passes. See `docs/release.md` for the required-checks list and branch-protection rules that mirror this policy.

If you're an outside contributor, your PR will be assigned to `@JasonTM17` automatically; please don't worry about reviewer selection.

### PR description template

```
## Summary
What changed and why. One paragraph.

## How I tested
Commands and steps a reviewer can re-run.

## Screenshots / GIFs
For UI changes.

## Related
ADRs, issues, prior PRs.
```

## Reporting bugs

Open a GitHub issue with:

- A clear title (`fix(judge): SIGSEGV on Rust submissions over 100KB`).
- Steps to reproduce.
- Expected vs actual behaviour.
- The commit SHA you tested.
- Logs (sanitised — never paste secrets).

For security vulnerabilities use the private channel in [SECURITY.md](SECURITY.md), not GitHub issues.

## Working on ADRs

Architecture-level changes need an Architecture Decision Record before implementation. Copy `docs/adr/template.md`, increment the number, fill in Context / Decision / Consequences / Alternatives. Open the ADR PR before the implementation PR — reviewers can disagree with the design before code is written.

## License

By contributing you agree your work is licensed under the [MIT License](LICENSE).

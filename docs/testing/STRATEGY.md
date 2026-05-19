# Test strategy

How LeetRank tests itself, in one document. Covers the test pyramid, per-service coverage targets, and the local commands to run each layer. Cross-references to the workflows that gate `main` are at the bottom.

## Pyramid

```
                  /\
                 /  \   load (k6) — performance regression
                /----\
               / e2e  \  e2e (Playwright) — golden paths only
              /--------\
             / contract \  contract (API + OpenAPI) — wire compatibility
            /------------\
           / integration  \  integration — service + Postgres + Redis
          /----------------\
         /      unit        \  unit — pure logic, in-process
        /--------------------\
```

The pyramid is the budget: most assertions live at the bottom (cheap, fast, isolated). Higher layers add value but cost runtime, flake risk, and CI minutes — we keep them lean.

## Layer responsibilities

| Layer | What it asserts | Where it runs | Tooling |
|---|---|---|---|
| Unit | Pure functions, schema validation, rendering shapes, business rules in isolation | local + CI | Vitest (TS), `go test` (Go), pytest (Py), RSpec (Ruby), `cargo test` (Rust) |
| Integration | A service boots, talks to its real Postgres/Redis dependency, and answers HTTP correctly | local + CI | Vitest + testcontainers, `go test` against ephemeral docker compose, FastAPI TestClient + asyncpg |
| Contract | OpenAPI specs lint, schemas match handlers, response bodies follow the spec | CI gate | Redocly (`pnpm openapi:lint`), schema diff in CI |
| E2E | A real browser walks the golden path: login -> open problem -> submit -> see verdict | CI nightly + on-demand | Playwright |
| Load | The stack survives target concurrency without breaching SLOs | scheduled | k6 (`scripts/loadtest`), reports under `load-test-results/` |

## Coverage targets per service

These are the targets we hold ourselves to. Coverage below the target is a release blocker only for the services marked **release-gated**.

| Service | Language | Target | Release-gated | Notes |
|---|---|---|---|---|
| `apps/web` (Next.js) | TS | 70 % statements | yes | Components covered by Vitest + Testing Library; happy paths covered by Playwright |
| `apps/api` | TS | 80 % | yes | Hono read API; pure handlers + zod validation, easy to cover |
| `services/auth-go` (identity) | Go | 80 % | yes | Tightest target — auth blast radius is largest |
| `services/problems-go` | Go | 75 % | yes | Read-heavy, table-driven tests for SQL repo |
| `services/submissions-go` | Go | 75 % | yes | Includes the queue write path and judge-dispatch contract |
| `services/realtime-go` | Go | 60 % | no | Most logic is pubsub fan-out; covered by integration tests |
| `services/leaderboard-rust` | Rust | 75 % | yes | Hot path — `cargo test` + `cargo nextest` |
| `services/notifications-ruby` | Ruby | 70 % | no | RSpec for unit, mocked SMTP/webhook |
| `services/analytics-python` | Python | 75 % | no | pytest + asyncpg fixtures |
| `judge-service` | Go | 70 % | yes | Sandbox boundary unit tests + a per-language smoke matrix |

Targets are statement coverage from each toolchain's default reporter. Branch coverage is tracked but not gated.

## Running tests locally

### TypeScript (`apps/web`, `apps/api`, packages)

```bash
pnpm install
pnpm test                 # vitest run, all workspaces
pnpm test:watch           # vitest in watch mode
pnpm test:coverage        # vitest + v8 coverage; html report at coverage/
pnpm openapi:lint         # redocly lint against the three OpenAPI specs
```

### End-to-end (Playwright)

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
pnpm test:e2e             # headless
pnpm test:e2e:ui          # Playwright UI mode for debugging
pnpm test:e2e:headed      # visible browser
```

The suite expects the stack to be reachable on the ports listed in `playwright.config.ts`. Spec files live in `e2e/` — current set: `golden-path`, `smoke`, `submit-auth-required`, `theme`.

### Go services

Run from the service directory:

```bash
cd services/auth-go
go test ./...
go test -race ./...                          # race detector
go test -coverprofile=cover.out ./...
go tool cover -func=cover.out                # text summary
go tool cover -html=cover.out                # html report
```

Same shape works in `services/problems-go`, `services/submissions-go`, `services/realtime-go`, and `judge-service`.

### Rust (`services/leaderboard-rust`)

```bash
cd services/leaderboard-rust
cargo test                                   # default
cargo test --release                         # benchmarks-friendly
cargo install cargo-llvm-cov && cargo llvm-cov --html
```

### Python (`services/analytics-python`)

```bash
cd services/analytics-python
pip install -e ".[dev]"
pytest -q
pytest --cov=app --cov-report=html
```

### Ruby (`services/notifications-ruby`)

```bash
cd services/notifications-ruby
bundle install
bundle exec rspec
bundle exec rspec --format documentation
```

### Load (k6)

```bash
k6 run scripts/loadtest/submit-flow.js
# Reports written to load-test-results/<timestamp>/
```

The load harness expects the full stack up. See [docs/load-testing.md](../load-testing.md) for the SLO matrix and how to interpret the percentile output.

## CI gates

Every PR runs the lanes from the README status table. The relevant lanes for this strategy:

| Workflow | Layer | Gate |
|---|---|---|
| `ci.yml` | unit + lint + typecheck (TS) | required |
| `api-tests.yml` | contract + integration (Hono) | required |
| `python-tests.yml` | analytics-python unit | required |
| `ruby-tests.yml` | notifications-ruby unit | required |
| `rust-tests.yml` | leaderboard-rust unit | required |
| `e2e.yml` | Playwright golden paths | required |
| `lighthouse.yml` | a11y + perf budget | informational, blocks release |
| `bundle.yml` | bundle size budget | informational, blocks release |
| `load-test.yml` | k6 scheduled run | scheduled, blocks release if SLO breach |

## Test data

- Postgres seed: `pnpm db:seed` loads 100+ problems, tags, and the demo accounts (`admin@leetrank.local` / `Admin123!`, `demo@leetrank.local` / `Demo123!`).
- Per-service Go tests use `testdata/` fixtures — never the live seed.
- Playwright relies on the seed; the suite is idempotent (creates submissions but does not delete others' data).
- Load harness uses synthetic users created at the start of each run and torn down after.

## Flake policy

A test that fails twice on the same SHA is opened as an issue with the `flake` label and the suite is rerun once. A test that flakes three times in a week is quarantined (skipped + tracked). Quarantine is **not** a fix — the issue has to land within one sprint or the test goes back into the suite.

## See also

- [docs/load-testing.md](../load-testing.md) — k6 harness, SLOs, percentile reading guide
- [docs/runbooks/api.md](../runbooks/api.md) — production alert thresholds align with the load-test budget
- [docs/architecture/data-flow.md](../architecture/data-flow.md) — the lifecycle the e2e suite walks
- ADR 0024 — observability stack (where coverage and test counts surface in dashboards)

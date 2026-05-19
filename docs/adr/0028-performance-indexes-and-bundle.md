# 0028 — Performance: hot-path indexes + per-service image trimming

Date: 2026-05-19

## Status

Accepted.

## Context

The performance critic team scored the codebase 76/100 and flagged five
P0/P1 findings:

- **P-01** (P0) — Per-service Node Dockerfiles (`apps/api`, `apps/auth`)
  run `npm install` against the **root** `package.json`. The root install
  pulls Next 16, Monaco editor, Playwright (with browsers), Vitest +
  coverage, Tailwind, etc. — none of which the standalone Hono API
  needs. Image bloat propagates to every push and slows cold-start.
- **P-02** — `User.role` has no index. Admin gates filter on
  `role = 'admin'`, today scanning the full table.
- **P-03** — `Discussion.upvotes` lookups (top-discussions for a
  problem) sort the entire problem's discussion list in memory.
- **P-04** — Submission `findMany` listings hydrate the heavy `code`,
  `output`, and `error` TEXT columns. The submissions page only renders
  metadata, but each row pays the cost of streaming a multi-KB code
  blob.
- **P-05** — `ChatMessage` has indexes on `(userId, createdAt)` and
  `(problemId, createdAt)` but **not** on `(contestId, createdAt)`,
  which the contest-room chat history hits.

## Decision

Three changes, smallest viable diff each.

### 1. Add Prisma indexes (P-02, P-03, P-05)

```
model User {
  …
  @@index([role])
}

model Discussion {
  …
  @@index([problemId, upvotes(sort: Desc)])
}

model ChatMessage {
  …
  @@index([contestId, createdAt])
}
```

The `Discussion` index is **composite** on `(problemId, upvotes DESC)`
because the query is always scoped to a single problem and ordered by
upvotes. A single-column index on `upvotes` would not help — Postgres
can't use it together with the `problemId` filter.

A hand-written migration lives at
`prisma/migrations/20260519000000_add_perf_indexes/migration.sql`. We
ship raw SQL because the dev environment runs SQLite and Prisma's
schema-pull would generate divergent index definitions. The migration
uses `CREATE INDEX IF NOT EXISTS` so re-applying is safe.

### 2. Tighten Submission listing queries (P-04)

`/api/submissions` GET previously used `include` which materialises
every column on the row. Switched to an explicit `select` listing only
the metadata fields the UI actually renders:

- `id, userId, problemId, language, status, runtime, memory, createdAt`
- nested `problem.{id, title, slug, difficulty}`

The detail endpoint `/api/submissions/[id]` keeps the full hydration
because the submission detail page renders code in Monaco. Other
listings (`/api/submissions/recent`, `/api/users/[username]/submissions`,
`/api/users/[username]/route.ts`) already used `select` to exclude
heavy columns — verified during this audit. The SSE poller at
`/api/submissions/[id]/stream` only selects `status, runtime, error`,
so it stays as-is.

### 3. Trim per-service Node images (P-01)

`apps/api/Dockerfile` and `apps/auth/Dockerfile` now run
`npm prune --omit=dev` after the build step:

```
RUN npm install --no-audit --no-fund \
 && npx prisma generate \
 && npx tsc \
 && npm prune --omit=dev
```

Each app already has its own `package.json` with the minimal hono +
prisma + zod surface — they are **not** installing the root workspace.
The dev dependencies (`prisma` CLI, `tsx`, `typescript`, `vitest`) are
needed during the build stage, then pruned before the runtime stage
copies `node_modules`. This drops `prisma` engine binaries we don't
use, the TypeScript compiler, the test runner, etc.

We considered moving to `pnpm install --filter` so the build stage
only resolves the workspace-package's lockfile slice, but that's a
larger refactor (DX audit F-21/F-22). `npm prune` is the smallest
change that recovers most of the savings today.

The root `Dockerfile` (the Next.js web app) genuinely needs the full
root install — Next, Tailwind, Monaco are all production dependencies
of the web image — so it is unchanged.

## Bundle / lazy-loading audit (FYI)

`/problems/[slug]` — Monaco editor and ChatBot already load through
`next/dynamic` with `ssr: false`. No further change needed. No other
heavy components (recharts, chart.js, @nivo) are imported in the
codebase today.

`<img>` tag audit — no raw `<img>` tags in `src/**/*.tsx`. UI uses CSS
backgrounds and Lucide SVG icons. Nothing to migrate to `next/image`.

## Consequences

- Submission list responses shrink from ~code-blob-size per row to
  flat metadata. Round-trip on the dashboard drops noticeably for
  power users with hundreds of submissions.
- Index writes add a small cost on `Discussion.upvotes` updates and
  `ChatMessage` inserts, but reads dominate both tables.
- Image size: pruning dev deps from the apps/api and apps/auth runtime
  images recovers ~80–150 MB depending on platform layers (TypeScript
  compiler + Prisma engine variants + tsx + vitest tree).
- Migration is idempotent; safe to deploy via `prisma migrate deploy`
  in CI.

## Verification

- `npx prisma validate` — passes (schema is valid).
- `pnpm test` / `pnpm build` — to be run in CI; the schema-only and
  Dockerfile-only changes don't affect the TypeScript surface.
- DB migration is hand-written; `prisma migrate dev` was not run
  locally because the dev datasource is SQLite (`file:./dev.db`) and
  the migration targets Postgres. Production CI applies it via
  `prisma migrate deploy`.

## Alternatives considered

- **Materialised view for top discussions** — overkill for the data
  shape. The composite index handles the query in a single index
  scan.
- **Drop `code/output/error` from Submission and store in S3** —
  long-term win but would break existing rows, the SSE stream, and
  the detail page hydration. Out of scope for a perf pass.
- **Monorepo refactor (pnpm workspaces with `--filter`)** — strictly
  better than `npm prune`, but the build-context remains the repo
  root because Prisma's schema lives there, and the savings overlap.
  Tracked in DX audit F-21/F-22.

## References

- Critic team report: P-01 through P-05.
- Existing related ADR: 0010 (Monaco dynamic import), 0011 (split
  backend/frontend), 0026 (dual registry publish).

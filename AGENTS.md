<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Hard-won rules (LeetRank-specific)

These are project-specific lessons paid for in time wasted. Universal rules live in the global agent memory; this list is what you must know to be productive in **this** repo.

### Prisma + TypeScript

- Always run `pnpm prisma generate` before `pnpm typecheck` or `pnpm build`. The Prisma client must exist or `@prisma/client` exports collapse to `{}` and every `.map()` / `select` callback hits TS7006. CI workflows enforce this; local scripts in `package.json` chain `prisma generate &&` so editor LSP works after a fresh clone.
- After every schema change in `prisma/schema.prisma`: `pnpm prisma generate` + commit the generated migration in `prisma/migrations/`. Never edit existing migration SQL — write a new migration to fix mistakes.

### pnpm + workspace

- This repo uses **pnpm 10+**. Do not downgrade — `pnpm-workspace.yaml` overrides only resolve under pnpm 10. CI pins `pnpm/action-setup@v4` with `version: 10`.
- After dependency changes, verify with `pnpm why <pkg>` that overrides actually pinned the intended version.

### Service naming

- Service names are responsibility-based, not language-tagged: prefer `identity`, `submissions`, `problems`, `judge`. The `-go` suffixes (`auth-go`, `submissions-go`, `problems-go`) are legacy and stay until a coordinated rename — do not introduce new language-suffixed names.
- The canonical auth issuer is `services/auth-go` (image `nguyenson1710/leetrank-identity`). The retired TypeScript service at `apps/auth` is gone — see [ADR 0027](docs/adr/0027-retire-apps-auth.md). Any new doc, runbook, or compose file must point to identity, not `apps/auth`.

### API route validation

- Every mutating Next.js API route (`POST` / `PATCH` / `PUT` / `DELETE`) under `app/api/` must call `Schema.safeParse(body)` before any DB write. No raw `await request.json()` reaching the database.
- Audit gate: `grep -rn "request\.json()" app/api | grep -v "safeParse\|zod"` must return zero — that's a CI gate target.

### Per-page metadata

- Every dynamic segment under `app/` (anything matching `app/**/[*]/**/page.tsx`) must export `generateMetadata` returning real DB-driven `{ title, description, openGraph, twitter }`. The shared root layout title is for the home page only.
- Audit: `fd 'page\.(tsx|ts)$' app/ | xargs grep -L 'generateMetadata' | grep '\['` should return empty.

### Auth (JWT) cutover discipline

- The HS256 → Ed25519 + JWKS migration runs in three phases (see [ADR 0030](docs/adr/0030-web-tier-jwt-cutover.md)). Never skip phase 2. The `LEGACY_HS256_FALLBACK` env flag stays alive until phase 3 is complete on every consumer.
- `services/auth-go` is the **sole** issuer in production. Web, API, and Go services verify via JWKS only — none of them sign tokens, none of them hold the private key.

### Rate limiting + lockout

- Auth endpoints carry both per-IP rate limiting (Redis sliding window) and per-account lockout (`failed_login_count` + `locked_until` columns on `users`). Both ship together — rate limiter alone doesn't stop botnet account-targeted brute force.
- Generic responses on auth failure: never reveal whether email exists. Single error message, single status code.

### Webhooks

- Every outbound call to n8n carries an `X-Signature-SHA256` HMAC of the body using `WEBHOOK_SECRET` from env. n8n verifies with timing-safe compare. URLs without HMAC are not allowed.

### Error + loading boundaries

- Every top-level segment under `app/` must have sibling `error.tsx` and `loading.tsx`. Both files inherit the project UI vocabulary — Navbar + Footer wrap, Skeleton blocks for loading, EmptyState-style retry CTA for error. White-screen errors and frozen-page loads are not acceptable.

### CI gates: advisory first

- New lint / format / coverage gates land with `continue-on-error: true` first. File a tracking issue, fix the surfaced failures, then flip to strict in a follow-up PR. Recent examples: rust `clippy` and rust `fmt` are advisory until baseline lands. The pattern keeps `main` green during incremental hardening.

### Screenshots — populated success state, no exceptions

- README and `docs/screenshots/` must show populated UI: ≥ 3–5 rows of real data on list pages, full markdown body on detail pages, logged-in chrome on auth-gated pages. Never commit captures of 404, empty list, loading skeleton, or auth redirect screens.
- Re-seed DB and re-capture after any major UI sweep (the `/seed` and `scripts/screenshot.ts` paths are the supported workflow).

### UI sweep vocabulary

- Every `app/**/page.tsx` route inherits the project UI vocabulary: `<Breadcrumb>`, `animate-fade-in-up` heading block, `gradient-text` H1 keyword, `<EmptyState>` for no-data branches, dot-prefix status badges, `hover:shadow-elevated hover:-translate-y-0.5 transition-all` on cards, `shadow-glow` on active CTAs.
- When a UI/UX issue is reported, sweep all surfaces — don't patch one page in isolation.

### Commit identity

- Sole contributor: `Nguyen Tien Son <jasonbmt06@gmail.com>` (GitHub `JasonTM17`). Every commit author must match. **Never** add `Co-Authored-By: Claude` or any `Generated with` trailer. This is enforced repeatedly because the default tooling tries to inject AI attribution — strip it before commit, every time.

### ADR discipline

- One decision per file under `docs/adr/`. Append-only — supersede with a new ADR rather than editing accepted ones. Reference [ADR template](docs/adr/template.md) when adding.
- Every architecturally significant change in this repo gets an ADR before merge — that's how `0001`–`0031+` accumulated.

### Containers — Docker Hub

- All images publish to Docker Hub under `nguyenson1710/leetrank-*`. CI auto-pushes `latest` + git-SHA tag on every push to `main`. Repo secrets `DOCKERHUB_USERNAME` (= `nguyenson1710`) and `DOCKERHUB_TOKEN` are configured in GitHub Actions — do not hardcode anywhere.

### Private docs — never commit

- `PLAN*.md`, `NOTES*.md`, `TODO*.md`, `DRAFT*.md`, `*.private.md`, `*.local.md`, `.claude/`, `.omc/`, `.claude-private/` are all gitignored. If a `git status` before commit shows any of these, abort the `git add` and re-scope the commit.

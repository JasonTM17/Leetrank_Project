# Backend / Frontend split — migration runbook

Companion to [ADR 0011](../adr/0011-split-backend-frontend.md). The ADR is
the why and the high-level plan; this runbook is the working checklist.

## Status

| Phase | Description | State |
| --- | --- | --- |
| 1 | Workspace + apps/api scaffold + api-contracts | **Done** |
| 2 | Migrate read-only public endpoints | **In progress** — leaderboard/top, tags, contests done |
| 2.5 | Shared Redis cache (replaces in-process TTLCache) | Pending |
| 3 | Migrate auth + write paths | Not started |
| 4 | Drop /api routes from web | Not started |
| 5 | Optional Go port for hot endpoints | Deferred |

## Phase 1 — Workspace conversion (done)

Already landed:

- `pnpm-workspace.yaml` declares `apps/*`, `packages/*`, `services/*`.
- `apps/api/` standalone Hono service (package.json, tsconfig, Dockerfile,
  README, src/server.ts).
- `packages/api-contracts/` shared Zod schemas + types.
- Root `tsconfig.json` excludes `apps/` and `packages/` so each workspace
  package owns its own typecheck.
- `docker-compose.yml` runs the new `api` service alongside `app` and
  `judge`.
- CI has a dedicated `api` job (`apps/api` typecheck + build) that gates
  the docker image build matrix.
- Docker Hub publish workflow now ships `jasontm17/leetrank-api`
  alongside the existing app and judge images.

What's intentionally **not** done in phase 1:

- Moving `src/` under `apps/web/`. The web app still lives at the repo
  root. Moving it is invasive (paths, next.config, lots of CI changes)
  and is deferred to phase 4 — by then most of `src/app/api/` is empty
  anyway, so the move is smaller.

## Phase 2 — Migrate read-only public endpoints

Each endpoint moves on its own commit, with verification at every step:

### Per-endpoint checklist

For `/<path>`:

1. **Schema first.** Add the request/response Zod schema in
   `packages/api-contracts/src/schemas.ts`. Export the inferred type.
2. **Implement in apps/api.** Create `apps/api/src/routes/<path>.ts` with
   the handler. Use the same prisma queries as the web app's existing
   handler. Mount in `apps/api/src/server.ts`.
3. **Verify the response shape.** Hit the new endpoint locally and diff
   the JSON against the web app's existing handler:
   ```bash
   curl -s http://localhost:3000/api/<path> | jq -S . > /tmp/web.json
   curl -s http://localhost:4000/<path>     | jq -S . > /tmp/api.json
   diff /tmp/web.json /tmp/api.json
   ```
   Anything other than empty diff blocks the cutover.
4. **Cutover.** Set `WEB_API_PROXY_BASE=http://api:4000` (or staging URL)
   and rewrite the web app's handler to fetch from the API and pass
   through. The web URL stays unchanged for clients.
5. **Bake.** Watch logs and metrics for 24h. Roll back is
   `unset WEB_API_PROXY_BASE`.
6. **Delete.** Once the bake confirms parity, remove the web app's
   prisma access for the endpoint.

Endpoints in scope for phase 2 (read-only, no auth):

- [x] `GET /leaderboard/top` — implemented in apps/api, web cutover
      pending.
- [x] `GET /tags` — implemented in apps/api, web cutover pending.
- [x] `GET /contests` — implemented in apps/api, web cutover pending.
- [ ] `GET /problems` (list)
- [ ] `GET /problems/:slug`
- [ ] `GET /problems/trending`
- [ ] `GET /problems/random`
- [ ] `GET /tags/:slug`
- [ ] `GET /contests/:slug`
- [ ] `GET /contests/:slug/leaderboard`
- [ ] `GET /leaderboard` (paginated)
- [ ] `GET /users/:username`

## Phase 2.5 — Shared cache

The web app's in-process TTLCache becomes a problem the moment the API
joins the deployment — both processes will compute and cache the same
keys independently, doubling the load on Postgres and stale-window
asymmetries cause confusing UX.

Plan: introduce a Redis-backed cache adapter with the same interface
(`get`, `set`, `delete`, `remember`, `stats`) so callers don't change.
Existing TTLCache becomes the unit-test in-memory implementation.

## Phase 3 — Migrate auth + write paths

Auth (login, register, logout, me) is the linchpin. Once the cookie is
issued by `apps/api` and verified there, the web app can stop reading
users from the database entirely. JWT secret is shared across both
services from day one (see `docker-compose.yml`) so the migration is
just relocating the issuer.

Order:

1. `POST /auth/login` + `POST /auth/register` + `POST /auth/logout`
2. `GET /auth/me`
3. `POST /submissions` + `POST /run-code` (talk to the judge)
4. Discussions, bookmarks, contests join/leave
5. Admin namespace last — lowest traffic, highest blast radius if broken

## Phase 4 — Cut the cord

Once `apps/web/src/app/api/` only contains rendering-coupled routes
(auth callbacks, OG image generation, sitemap, robots), drop the prisma
import from the web app entirely. CI lint rule prevents it from being
re-added:

```js
// .eslintrc.cjs
{
  "rules": {
    "no-restricted-imports": ["error", { "patterns": ["@/lib/db", "**/prisma/client"] }]
  }
}
```

## Phase 5 — Optional Go port

When a hot endpoint's CPU profile is dominated by serialisation rather
than database work, port it to Go alongside the existing judge service.
The judge service is precedent: standalone Go binary, its own Dockerfile,
its own port, talks to the rest of the stack over HTTP.

## Rollback

Each phase is independently reversible:

- **Phase 1** — delete `apps/`, `packages/`, `pnpm-workspace.yaml`.
  Web app still works because nothing depends on the new packages yet.
- **Phase 2** — `unset WEB_API_PROXY_BASE` per endpoint. Web app's
  handler still has the prisma fallback path until phase 2 completes.
- **Phase 3** — auth migration commits each ship with the web fallback
  intact; cutover is a single env flip.
- **Phase 4** — once we delete the web prisma path this is the only
  point of no return. Tag the commit before merging so reverting is
  `git revert <tag>` rather than archaeology.

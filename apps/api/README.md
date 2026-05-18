# @leetrank/api

Standalone HTTP service for the LeetRank platform. Built on
[Hono](https://hono.dev/) running under Node.js.

This package was scaffolded as part of the FE/BE split documented in
[ADR 0011](../../docs/adr/0011-split-backend-frontend.md). It does not yet
own the production API surface — the canonical handlers still live in
`apps/web/src/app/api/`. Routes are migrated here one vertical slice at a
time; until the migration completes, the web app proxies opt-in traffic to
this service via the `WEB_API_PROXY_BASE` environment variable.

## Layout

```
apps/api/
├── src/
│   └── server.ts        # Hono app + Node entrypoint
├── Dockerfile           # Multi-stage build, alpine runtime
├── package.json
└── tsconfig.json
```

## Scripts

- `pnpm dev` — `tsx watch src/server.ts` for local development
- `pnpm build` — TypeScript compile to `dist/`
- `pnpm start` — production entry, runs `dist/server.js`
- `pnpm typecheck` — strict-mode `tsc --noEmit`
- `pnpm test` — Vitest

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_PORT` | `4000` | TCP port the HTTP server listens on |
| `CORS_ALLOWED_ORIGINS` | _(empty)_ | Comma-separated list of allowed origins. Empty = reflect the request origin (dev). |
| `DATABASE_URL` | (required) | Prisma URL — same Postgres as the web app for now |
| `JWT_SECRET` | (required in prod) | Shared secret with the web app so cookies issued by either service authenticate against both |

## Development

```bash
# from the repo root
pnpm install                # workspace-aware install
pnpm --filter @leetrank/api dev
```

Hit `http://localhost:4000/health` to verify.

## Endpoints

| Path | Method | Status |
| --- | --- | --- |
| `/` | GET | implemented (service banner) |
| `/health` | GET | implemented |
| `/leaderboard/top` | GET | planned (Phase 2 of ADR 0011) |
| `/tags` | GET | planned (Phase 2 of ADR 0011) |
| `/contests` | GET | planned (Phase 2 of ADR 0011) |

The full target surface lives in [`docs/openapi.yaml`](../../docs/openapi.yaml).

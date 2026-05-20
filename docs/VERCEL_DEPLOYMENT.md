# Vercel deployment — LeetRank web (Next.js)

This repo is a polyglot monorepo. **Only the Next.js web app at the repo root
deploys to Vercel.** Backend services (`apps/api`, `services/auth-go`,
`services/judge-service`, `services/submissions-go`, etc.) deploy separately
to Fly.io / Render / a Kubernetes cluster — Vercel cannot run nsjail, raw
TCP services, or the Go judge runner.

The deploy contract:

- `vercel.json` (root) pins build/install commands and gates which branches
  trigger deploys.
- `.vercelignore` (root) excludes the backend services + infra + docs from
  the build upload, keeping the build context small and fast.
- `next.config.ts` keeps `output: "standalone"` — Vercel handles that
  correctly; do not change to fit Vercel.

## Required environment variables

Set every value below in **Project → Settings → Environment Variables**.
Mark each one for the correct environment (Production / Preview /
Development).

| Variable                  | Required                                     | Where to source                                                   | Notes                                                                                                                         |
| ------------------------- | -------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | yes                                          | Vercel Postgres (Neon) marketplace integration auto-injects this. | Use the pooled `DATABASE_URL`; runtime queries go through pgbouncer.                                                          |
| `DIRECT_URL`              | only if running `prisma migrate` from CI     | Same Neon dashboard, "direct" connection string.                  | Skip if you run migrations from your laptop or a dedicated runner.                                                            |
| `JWT_SECRET`              | yes                                          | `openssl rand -hex 32`                                            | 32+ characters. Web tier verifies legacy HS256 only — production signing lives in `services/auth-go`.                         |
| `REDIS_URL`               | yes                                          | Upstash Redis marketplace integration.                            | Powers the rate limiter (per-IP sliding window) and account-lockout counters.                                                 |
| `NEXT_PUBLIC_APP_URL`     | yes                                          | Your Vercel domain.                                               | e.g. `https://leetrank.vercel.app` or the custom domain. Used in OG metadata + absolute redirects.                            |
| `JUDGE_SERVICE_URL`       | optional                                     | External judge host.                                              | If unset, submission flow shows "Demo mode" — Vercel cannot run nsjail.                                                       |
| `N8N_CHATBOT_WEBHOOK_URL` | optional                                     | Self-hosted n8n webhook URL.                                      | Chat falls back to canned local replies if unset.                                                                             |
| `N8N_HMAC_SECRET`         | required if `N8N_CHATBOT_WEBHOOK_URL` is set | `openssl rand -hex 32`                                            | Must match the value in the n8n workflow's verify node.                                                                       |
| `NODE_ENV`                | yes                                          | `production`                                                      | Vercel sets this automatically for Production deploys; assert it in env settings for Preview if you need prod-like behaviour. |

Vars that are only relevant inside docker-compose (`POSTGRES_*`,
`REDIS_PASSWORD`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `API_PORT`,
`CORS_ALLOWED_ORIGINS`, `N8N_HOST`, `N8N_PORT`) do **not** belong on Vercel.

## Setup walkthrough

1. **Connect the repo at vercel.com.**
   - New Project → Import Git Repository → select `Leetrank_Project`.
   - Framework preset: Next.js (auto-detected).
   - Root directory: keep at `/` — `vercel.json` already scopes the build.
   - Build/install commands: keep the values from `vercel.json`
     (`pnpm prisma generate && pnpm build` and
     `pnpm install --frozen-lockfile`).

2. **Provision Vercel Postgres (Neon) via the Marketplace.**
   - Storage → Create → Postgres (Neon) → attach to the project.
   - Vercel auto-injects `DATABASE_URL` for every environment.
   - First deploy: open the Neon console → SQL editor → run the migrations
     from `prisma/migrations/*/migration.sql` in chronological order, or
     run `pnpm prisma migrate deploy` from a workstation pointed at the
     Neon `DIRECT_URL`.

3. **Provision Upstash Redis via the Marketplace.**
   - Storage → Create → Upstash for Redis → attach to the project.
   - Vercel auto-injects `REDIS_URL` (and `KV_REST_API_*` if you want the
     HTTP client; the codebase uses `ioredis` against `REDIS_URL`).

4. **Set `JWT_SECRET` for production.**

   ```bash
   vercel env add JWT_SECRET production
   # paste the output of `openssl rand -hex 32` when prompted
   ```

   Repeat for `preview` if you want preview deploys to authenticate.

5. **Set `NEXT_PUBLIC_APP_URL`** to the production domain (default
   `https://<project>.vercel.app`, swap to your custom domain after
   verifying DNS).

6. **Confirm `NODE_ENV=production`** is set for Production deploys
   (Vercel does this automatically; verify in the env table).

7. **Deploy.** Push to `main`, or click _Deploy_ in the dashboard.

## Limitations

- **Judge service is NOT deployed to Vercel.** Code execution requires
  nsjail + cgroups + writable tmpfs. Vercel Functions cannot satisfy any
  of those. The submission flow gracefully degrades to "Demo mode" when
  `JUDGE_SERVICE_URL` is unset; otherwise it forwards to the external
  judge URL you supply (Fly.io / Render / k8s).
- **Long-running workers and cron jobs** (Glicko-2 batch updates, daily
  digests, n8n workflow handlers) run outside Vercel. Use Vercel Cron
  only for short HTTP-trigger tasks; offload heavy work to the external
  worker pool.
- **WebSocket-heavy code playback** is best fronted by an external host;
  Vercel's edge-to-function model is not the right shape for sustained
  bidirectional streams.

## Test the deployment locally

```bash
# Install vercel CLI once: npm i -g vercel  (or pnpm dlx vercel)
vercel link            # link the local checkout to the Vercel project
vercel pull            # pull env vars + project config to .vercel/
vercel build           # run the same build pipeline Vercel uses
vercel dev             # run the project locally with the Vercel runtime
```

`vercel build` writes `.vercel/output/` — useful for diffing the build
artefact when something only fails on Vercel.

## Promote a preview to production

```bash
vercel --prod
```

Or, in the dashboard: _Deployments_ → pick the green preview → _Promote
to Production_. The Git workflow is the recommended path: merge to
`main` → Production deploy fires automatically because of
`git.deploymentEnabled.main` in `vercel.json`.

## Rollback

Dashboard → _Deployments_ → pick the last known-good production deploy
→ _Promote to Production_. Vercel keeps every deploy artefact, so
rollbacks are instant and do not require a rebuild.

## Notes on Prisma + Neon

- The schema currently does not declare `directUrl` or `shadowDatabaseUrl`.
  That is fine for runtime — the pooled `DATABASE_URL` is what Vercel
  Functions need.
- If you start running `prisma migrate dev` against Neon (not just
  `migrate deploy`), add this to `prisma/schema.prisma`:

  ```prisma
  datasource db {
    provider          = "postgresql"
    url               = env("DATABASE_URL")
    directUrl         = env("DIRECT_URL")
    shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
  }
  ```

  and provision a separate Neon shadow branch for `SHADOW_DATABASE_URL`.
  Most teams skip this and run `prisma migrate dev` against a local
  postgres instead — see ADR 0007 if it exists, or open a new ADR before
  flipping.

## Reference

- `vercel.json` — build/install/framework pin, deploy gating.
- `.vercelignore` — keeps backend services + docs out of the build context.
- `next.config.ts` — security headers, standalone output (compatible
  with Vercel; Vercel ignores `output: "standalone"` and uses its own
  bundling).
- `.env.example` — has a "Vercel deployment" comment block at the top.

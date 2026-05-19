# 25. Secret management: env via Docker, no `.env` in the repo

Date: 2026-05-19

## Status

Accepted.

## Context

LeetRank handles three classes of secret:

1. **Auth-critical:** `JWT_SECRET`, future Ed25519 private key, OAuth client secrets.
2. **Database:** `DATABASE_URL` with embedded password, `REDIS_PASSWORD`.
3. **Third-party:** Docker Hub token, OpenAI/Anthropic keys for the n8n chatbot, SMTP credentials.

Three patterns are widespread in the wild — only one is acceptable here:

| Pattern | Verdict |
|---------|---------|
| Commit a `.env.production` to git | Rejected — irreversible exposure on push |
| `.env` file mounted into the container | Acceptable for local dev only |
| Secrets as orchestrator-injected env vars | Adopted for production |

The user's global rule (`Secrets handling — STRICT` in CLAUDE.md) requires that secrets exist only on the user's local machine and never in the repo, transcripts, or CI logs.

## Decision

### Production

- Secrets are **always** injected as environment variables by the orchestrator (Docker Compose with an external `.env` file outside the repo, Kubernetes Secrets, or the cloud provider's secret manager).
- The repo contains `.env.example` and `.env.production.example` only — **template** files with placeholder values. Both are checked into git; both have all real values redacted.
- `.env`, `.env.local`, `.env.production`, and any variant matching `.env.*` (except the two `.example` templates) are gitignored. Already enforced by `.gitignore`.
- Each service's `internal/config` (Go) or `src/env.ts` (TS) **fails fast at boot** when a required secret is missing or below the minimum complexity bar. No silent fallback to a dev value in `NODE_ENV=production`.

### Local dev

- Developers copy `.env.example` to `.env` and fill in dev-grade values. The dev fallback `JWT_SECRET` in `apps/api/src/env.ts` exists explicitly for first-run smooth-out and is **disabled** when `NODE_ENV=production`.
- Compose mounts the local `.env` via `env_file:` directive. Compose itself never echoes the secret values into logs.

### CI / CD

- GitHub Actions reads secrets from the repo's `Secrets and variables` settings, **never** from a committed file. Required secrets:
  - `DOCKERHUB_USERNAME` (= `nguyenson1710`)
  - `DOCKERHUB_TOKEN`
  - `JWT_SECRET` (build-only dummy is fine for `next build`; production secret never goes through CI)
- Workflow files reference secrets via `${{ secrets.NAME }}`. The runner masks the value in logs.

### Rotation

| Secret | Rotation cadence | Trigger |
|--------|------------------|---------|
| `JWT_SECRET` | 90 days | Calendar reminder; rotate by issuing new key, double-verifying for one TTL window, then retiring old |
| Database password | 180 days | Calendar reminder; coordinate with replica resync |
| Docker Hub token | On personnel change | Off-board another account holder |
| LLM provider keys | On suspected leak | Vendor dashboard alert |
| Ed25519 signing key (Phase 3.1.5+) | Annual + on-incident | JWKS rotation handles it without service restart |

If a secret is suspected leaked: rotate immediately, audit access logs for the past 90 days, file a post-incident note in `docs/runbooks/`.

### Local guarding

- Pre-commit hook (`.husky/pre-commit`) runs `git diff --staged | grep -E '(JWT_SECRET=[^[:space:]]+|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})'` and fails the commit on any match. Same regex set lives in CI as a belt-and-braces check.
- Editor users should add the same patterns to their local secret-scanning extension.

## Consequences

**Positive:**

- Repo never contains live secrets. A repo leak does not auto-leak credentials.
- Rotation is decoupled from deploys — change the secret in the orchestrator, restart the service, no code change.
- `.env.example` doubles as documentation of which variables a service needs.
- Aligns with the global `Secrets handling — STRICT` rule.

**Negative:**

- New developer onboarding is slightly slower — they need to copy `.env.example`, fill in values, and run a local Postgres or compose. Documented in `docs/onboarding.md`.
- Multi-stage Docker builds cannot bake secrets into images. Build-time-only credentials (e.g. private package registries) require Docker BuildKit secret mounts (`--mount=type=secret,id=...`).

**Neutral:**

- Compose remains the single source of truth for which env vars each service expects.

## What goes where

| Secret | Lives in |
|--------|----------|
| Production database URL | Cloud secret manager → orchestrator env injection |
| Production `JWT_SECRET` | Cloud secret manager → orchestrator env injection |
| Dev database URL | `.env` on developer machine (gitignored) |
| Dev `JWT_SECRET` | `.env` on developer machine, or the documented insecure fallback |
| CI Docker Hub token | GitHub Actions repository secret |
| LLM provider keys | n8n credential vault (n8n Postgres, encrypted at rest) |

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| HashiCorp Vault | Operational overhead disproportionate to current scale; revisit if multi-region (ADR 0023) lands |
| AWS Secrets Manager / Parameter Store | Vendor lock; incompatible with self-host requirement |
| Encrypted `.env` in the repo (sops, git-crypt) | Decrypt key still needs out-of-band distribution; saves nothing operationally |
| Environment-variable-free secrets (file mount) | Equivalent in security; env vars are the simpler default for our service shape |

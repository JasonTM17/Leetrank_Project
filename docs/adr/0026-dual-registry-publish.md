# 0026 — Dual-registry container publishing (Docker Hub + GHCR)

- **Status:** Accepted
- **Date:** 2026-05-19
- **Deciders:** @JasonTM17
- **Supersedes:** none
- **Related:** [ADR 0018 — Go services buildout](0018-go-services-buildout.md), [ADR 0024 — Observability stack](0024-observability-stack.md)

## Context

LeetRank publishes seven container images per release (`web`, `api`,
`auth`, `identity`, `submissions`, `problems`, `judge`). Until now CI
pushed only to Docker Hub under the `nguyenson1710/leetrank-*`
namespace. That single point of distribution has two known failure
modes:

1. **Anonymous pull rate limits.** Docker Hub throttles unauthenticated
   pulls to 100/6h per IPv4 and 200/6h per logged-in free account. CI
   reruns in fresh runners and contributors on shared NATs hit the
   ceiling fast, especially when bringing up the full stack.
2. **Single-vendor risk.** A Docker Hub outage, ToS change, or account
   suspension would knock the project's "one-command boot" promise
   offline with no fallback.

GitHub Container Registry (`ghcr.io`) is free for public repositories,
auto-attaches packages to the source repo (no extra account hop for
contributors), and uses the workflow's auto-provided `GITHUB_TOKEN` —
no new secrets to manage.

## Decision

Every image published from `main` (and every tagged release) is pushed
to **both** registries in the same job:

- `docker.io/nguyenson1710/leetrank-<service>:<tag>` (community-facing,
  unchanged URL)
- `ghcr.io/jasontm17/leetrank-<service>:<tag>` (auto-attached to the
  GitHub repo; lowercased per ghcr requirement)

The workflow `.github/workflows/docker-publish.yml` was rewritten to:

- declare job-level `permissions: { contents: read, packages: write,
  id-token: write }` (the latter for future cosign attestation),
- log in to both registries (Docker Hub via existing
  `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` secrets; GHCR via
  `${{ github.actor }}` + `${{ secrets.GITHUB_TOKEN }}`),
- emit a multi-line `images:` list to `docker/metadata-action@v5` so
  `docker/build-push-action@v7` builds once and pushes the resulting
  manifest list to **both** registries in a single step,
- verify each registry separately at the end of the job
  (`docker manifest inspect` on both `nguyenson1710/leetrank-<svc>:latest`
  and `ghcr.io/jasontm17/leetrank-<svc>:latest`).

The matrix was also refreshed to reflect the renamed services
(`web`, `identity`, `submissions`, `problems`) — the legacy
`app` / `auth-go` / `submissions-go` / `problems-go` slugs are gone
from compose and from the published image names.

## Rationale

- **Resilience.** Either registry can serve `docker compose pull`
  independently. A consumer behind a saturated Docker Hub quota can
  swap their compose file's image prefix to `ghcr.io/jasontm17/...`
  and unblock themselves.
- **Zero secret sprawl.** GHCR uses the auto-provisioned
  `GITHUB_TOKEN`. No new repo secret, no rotation policy.
- **One build, two pushes.** `metadata-action` + `build-push-action`
  collapses the dual-registry push into one BuildKit run; the
  `cache-from`/`cache-to` GHA scope is unchanged so per-service cache
  reuse still works.
- **Future cosign.** `id-token: write` at job level is the prerequisite
  for keyless cosign signing. Adding it now avoids a workflow rewrite
  later.

## Consequences

- **2x egress per build** for the push phase. The build itself runs
  once; only the layer upload is doubled. With BuildKit GHA cache hits
  this is a few hundred MB per push, well within free tier.
- **Two URLs to keep in docs.** Pull instructions list Docker Hub as
  primary and GHCR as fallback; compose files keep using the Docker
  Hub URL for backward compatibility.
- **Public packages on the GitHub repo.** Each service appears under
  https://github.com/JasonTM17?tab=packages once the first push lands.
  Visibility must be flipped to public manually the first time
  (GitHub default is private even when the repo is public).
- **No new CI secrets.** Existing Docker Hub secrets stay unchanged;
  `GITHUB_TOKEN` is auto-provided.

## Alternatives considered

- **Stay single-registry on Docker Hub.** Cheapest, but leaves the
  rate-limit and single-vendor risk above.
- **Switch entirely to GHCR.** Would break the documented
  `nguyenson1710/leetrank-*` URLs that downstream forks already script
  against. Dual-publish keeps both audiences happy.
- **Mirror via a registry proxy (e.g. Harbor).** Operational overhead
  not justified for a small public OSS project.

## Verification

After the first run on `main`:

```bash
docker manifest inspect nguyenson1710/leetrank-web:latest
docker manifest inspect ghcr.io/jasontm17/leetrank-web:latest
```

Both should return a multi-arch manifest list (`linux/amd64`,
`linux/arm64`). Repeat for the other six service slugs.

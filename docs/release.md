# Release Management

This document defines the versioning policy, release process, and branch protection rules for LeetRank.

## Versioning policy

LeetRank follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html):

```
MAJOR.MINOR.PATCH
```

| Bump | When | Examples |
|------|------|----------|
| **MAJOR** | Breaking API changes, incompatible schema migrations, removal of public endpoints | Auth protocol change, DB schema that requires data migration with downtime |
| **MINOR** | New features, non-breaking additions, new services | Study plans, achievements, new API endpoints, new language support |
| **PATCH** | Bug fixes, security patches, performance improvements, documentation fixes | Null-guard fix, rate-limit tuning, typo correction |

Pre-release versions use the format `MAJOR.MINOR.PATCH-rc.N` (e.g. `0.3.0-rc.1`).

## Version history

| Version | Date | Highlights |
|---------|------|------------|
| [0.2.0](https://github.com/JasonTM17/Leetrank_Project/releases/tag/v0.2.0) | 2026-05-19 | Study plans, daily challenge, achievements, Glicko-2 rating, editorial + hints, solution sharing, code playback, PWA, full EN+VI i18n, Ed25519+JWKS auth, nsjail sandbox, observability stack |
| [0.1.0](https://github.com/JasonTM17/Leetrank_Project/releases/tag/v0.1.0) | 2026-04-01 | Initial release: 34-language judge, contests, leaderboards, discussions, profiles, Monaco editor, chatbot, Docker Compose stack, 461 tests |

Full changelog: [CHANGELOG.md](../CHANGELOG.md).

## Release checklist

Before cutting a release:

1. **All CI checks green on `main`.** No exceptions. See [required checks](#required-status-checks) below.
2. **CHANGELOG.md updated.** Move items from `[Unreleased]` into a new `[X.Y.Z] - YYYY-MM-DD` section. Follow [Keep a Changelog](https://keepachangelog.com/) format.
3. **Migration notes documented.** If the release includes schema changes, document the migration path in the CHANGELOG `Migration notes` subsection.
4. **Version bumped in package.json.** Run `pnpm version <major|minor|patch> --no-git-tag-version`, then commit.
5. **Tag created and pushed.**
   ```bash
   git tag -a v0.3.0 -m "v0.3.0"
   git push origin v0.3.0
   ```
6. **GitHub Release published.** Use the tag. Copy the CHANGELOG section as the release body. Attach SBOM artifact.
7. **Docker images verified.** Confirm `docker-publish.yml` tagged images with the version on both Docker Hub and GHCR.

## Release flow

```
main ──────────────────────────────────────────────────►
       │                              │
       ├─ feat/study-plans ──► PR ──► │ (squash merge)
       │                              │
       ├─ fix/null-guard ────► PR ──► │ (squash merge)
       │                              │
       │                              ├── git tag v0.3.0
       │                              │
       │                              ▼
       │                         docker-publish.yml
       │                         → nguyenson1710/leetrank-*:v0.3.0
       │                         → nguyenson1710/leetrank-*:latest
```

On merge to `main`:
- `docker-publish.yml` builds every service image, pushes to Docker Hub (`nguyenson1710/leetrank-*`) and GHCR (`ghcr.io/jasontm17/leetrank-*`) with `latest`, branch, and short-SHA tags.
- `trivy.yml` rescans the filesystem and freshly published images.
- `sbom.yml` regenerates the workspace SBOM.

On `v*` tag push:
- The same `docker-publish.yml` workflow re-tags images with the semver version.
- GitHub Release is created (manually or via `release.yml` workflow).

## Hotfix process

For critical bugs or security issues on a released version:

```
v0.2.0 (tag)
    │
    └── hotfix/critical-auth-bypass (branch from tag)
            │
            ├── fix commit(s)
            │
            ├── PR → main (cherry-pick or merge)
            │
            └── git tag v0.2.1
```

Steps:

1. Branch from the release tag: `git checkout -b hotfix/description v0.2.0`
2. Apply the minimal fix. No feature work.
3. Open a PR against `main`. All CI checks must pass.
4. After merge, tag the patch release: `git tag -a v0.2.1 -m "v0.2.1"`
5. Push the tag. Verify Docker images publish with the patch version.
6. Update CHANGELOG.md with the patch entry.

## Required status checks

Branch protection on `main` requires all of the following to succeed before merge:

| Workflow | Job | Purpose |
|----------|-----|---------|
| `ci.yml` | `web` | Typecheck, lint, unit tests + coverage, Next.js build |
| `ci.yml` | `api` | Hono API typecheck + build |
| `ci.yml` | `judge` | Judge `go vet`, build, race-detector tests |
| `ci.yml` | `judge-sandbox-tests` | Privileged sandbox integration tests |
| `ci.yml` | `go-tests` | Vet + race tests for auth-go, problems-go, submissions-go, realtime-go |
| `ci.yml` | `audit` | `pnpm audit --prod --audit-level=high` |
| `ci.yml` | `e2e` | Playwright golden-path suite |
| `python-tests.yml` | `analytics-python` | Pytest for analytics service |
| `rust-tests.yml` | `leaderboard-rust` | Rustfmt + clippy + cargo test |
| `ruby-tests.yml` | `notifications-ruby` | RSpec for notifications service |
| `codeql.yml` | `CodeQL` | Security + quality queries (JS/TS, Go) |
| `trivy.yml` | `Trivy` | Filesystem scan (CRITICAL/HIGH) |
| `gitleaks.yml` | `Gitleaks` | Secret scan |
| `sbom.yml` | `SBOM` | CycloneDX SBOM generation |
| Codecov | `codecov/project` | Project coverage >= 80% |
| Codecov | `codecov/patch` | Changed lines covered >= 80% |

## Branch protection rules

Configured in **Settings > Branches > Branch protection rules** for `main`:

- Require pull request before merging
- Require at least 1 approving review (self-review accepted for solo maintainer)
- Require review from Code Owners
- Dismiss stale approvals on new commits
- Require all status checks to pass
- Require branches up to date before merging
- Require conversation resolution
- Require linear history
- Disallow force pushes
- Disallow branch deletion
- Apply rules to administrators

## Auxiliary signals (non-blocking)

These run on every PR but do not block merge:

| Workflow | Purpose |
|----------|---------|
| `bundle.yml` | Bundle size delta — investigate large jumps |
| `lighthouse.yml` | Performance / A11y / SEO budgets |
| `load-test.yml` | k6 load test scenarios |
| `postgres-backup.yml` | Backup verification |

## Action pinning policy

Every workflow pins third-party actions to a 40-character commit SHA with a trailing version comment:

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

Floating tags (`@master`, `@main`, `@v3`) are not allowed. Dependabot updates SHA pins weekly.

## Verification

```bash
# No floating tags on actions
grep -E '@(master|main|v[0-9]+)$' .github/workflows/*.yml | wc -l   # expect 0

# Every workflow YAML is parseable
python -c "import sys, yaml, glob; [yaml.safe_load(open(p)) for p in glob.glob('.github/workflows/*.yml')]; print('ok')"
```

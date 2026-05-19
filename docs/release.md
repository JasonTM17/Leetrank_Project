# Release & branch-protection policy

This document defines the rules that govern `main` for LeetRank: which CI checks are required, who reviews, and how releases ship to Docker Hub. It is the source of truth that the GitHub branch-protection rules should mirror — the rules can't be expressed in code today, so this file is the canonical reference until we adopt a tool like `repository-settings-as-code`.

## Required status checks (must be green before merge)

Branch protection on `main` requires all of the following workflow jobs to succeed before a PR can merge:

| Workflow file              | Job name              | Why it gates merge                                            |
| -------------------------- | --------------------- | ------------------------------------------------------------- |
| `.github/workflows/ci.yml` | `web`                 | Typecheck, lint, unit tests + coverage, and Next.js build.    |
| `.github/workflows/ci.yml` | `api`                 | Hono API typecheck + build.                                   |
| `.github/workflows/ci.yml` | `judge`               | Judge service `go vet`, build, and race-detector tests.       |
| `.github/workflows/ci.yml` | `judge-sandbox-tests` | Privileged sandbox integration tests against the judge image. |
| `.github/workflows/ci.yml` | `go-tests`            | Vet + race tests for `auth-go`, `problems-go`, `submissions-go`, `realtime-go` (matrix). |
| `.github/workflows/ci.yml` | `audit`               | `pnpm audit --prod --audit-level=high` (production deps).     |
| `.github/workflows/ci.yml` | `e2e`                 | Playwright golden-path against a freshly built Next app.      |
| `.github/workflows/python-tests.yml` | `analytics-python — pytest` | Pytest suite for the Python analytics service.       |
| `.github/workflows/rust-tests.yml`   | `leaderboard-rust — cargo test` | Rustfmt + clippy + cargo test for the leaderboard service. |
| `.github/workflows/ruby-tests.yml`   | `notifications-ruby — rspec`    | RSpec suite for the Ruby notifications service.       |
| `.github/workflows/codeql.yml`   | `CodeQL`              | CodeQL security + quality queries (JS/TS and Go).             |
| `.github/workflows/trivy.yml`    | `Trivy`               | Trivy filesystem scan (CRITICAL/HIGH).                        |
| `.github/workflows/gitleaks.yml` | `Gitleaks`            | Secret scan over the full history.                            |
| `.github/workflows/sbom.yml`     | `SBOM`                | CycloneDX SBOM generation must succeed.                       |
| Codecov status check       | `codecov/project`     | Project coverage stays at or above 80% (per `codecov.yml`).   |
| Codecov status check       | `codecov/patch`       | Changed lines covered at 80%+ (per `codecov.yml`).            |

The exact GitHub status-check names to paste into branch protection (one per line):

```
web
api
judge
judge-sandbox-tests
go-tests (auth-go)
go-tests (problems-go)
go-tests (submissions-go)
go-tests (realtime-go)
audit
e2e
analytics-python — pytest
leaderboard-rust — cargo test
notifications-ruby — rspec
CodeQL
Trivy
Gitleaks
SBOM
codecov/project
codecov/patch
```

## Branch protection rules

Configure these in **Settings → Branches → Branch protection rules** for the `main` pattern:

- Require a pull request before merging.
- Require at least **1** approving review. The repo is currently solo-maintained (see [`CODEOWNERS`](../.github/CODEOWNERS) and the "Review model" section in [`CONTRIBUTING.md`](../CONTRIBUTING.md)); GitHub will accept the maintainer's own approval after CI is green.
- Require review from Code Owners.
- Dismiss stale pull request approvals when new commits are pushed.
- Require status checks to pass before merging — list every check from the table above.
- Require branches to be up to date before merging.
- Require conversation resolution before merging.
- Require signed commits (recommended; enable when the maintainer's GPG / SSH signing key is provisioned).
- Require linear history.
- Disallow force pushes to `main`.
- Disallow deletions of `main`.
- Apply rules to administrators (so the maintainer can't accidentally bypass them).

## Auxiliary signals (not merge-blocking but watched)

These run on every PR but won't block merge — they exist to surface regressions early:

- `bundle.yml` (`bundle`) — appended to PR summary; investigate large jumps.
- `lighthouse.yml` (`lhci`) — performance/A11y/SEO budgets.
- `gitleaks.yml` (`scan`) — secret-scan; treat any finding as urgent and rotate.
- `sbom.yml` (`sbom`) — emits CycloneDX SBOM artifact (90-day retention).

## Release flow

1. Open a PR; let the required checks above run.
2. Self-review (or peer-review when contributors join), squash-merge using the Conventional Commit title.
3. On merge to `main`:
   - `docker-publish.yml` builds every service image, pushes to Docker Hub (`nguyenson1710/leetrank-*`) **and** GHCR (`ghcr.io/jasontm17/leetrank-*`) with `latest`, branch, and short-SHA tags. Provenance + SBOM attestations are attached.
   - `trivy.yml` rescans the filesystem and the freshly published images.
   - `sbom.yml` regenerates the workspace SBOM.
4. To cut a tagged release, push a `v*` git tag — the same `docker-publish.yml` workflow re-tags the images with the version.

## Action pinning policy

Every workflow pins third-party actions to a 40-character commit SHA, with a trailing comment recording the human-readable version (e.g. `# v6.0.2`). Floating tags such as `@master`, `@main`, or major-version aliases (`@v3`, `@v6`) are not allowed — they were the H-4 finding from the May 2026 critic review.

The Renovate / Dependabot config (`.github/dependabot.yml`) updates the SHA pins weekly; review the diff and the linked release notes before merging the bot's PR.

## Verification

Two greps keep the policy honest:

```bash
# 1. No floating tags on actions
grep -E '@(master|main|v[0-9]+)$' .github/workflows/*.yml | wc -l   # → 0

# 2. Every workflow YAML is parseable
python -c "import sys, yaml, glob; [yaml.safe_load(open(p)) for p in glob.glob('.github/workflows/*.yml')]; print('ok')"
```

Run both before merging changes that touch CI workflows.

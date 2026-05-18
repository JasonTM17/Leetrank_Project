<!-- Title format: Conventional Commits — feat|fix|docs|refactor|test|chore|ci|perf(scope): short description -->
<!-- Example: feat(judge): add Zig language support -->

## Summary

What does this PR change and why?

## Related issues

Closes #...

## Type of change

- [ ] Bug fix (`fix:`)
- [ ] New feature (`feat:`)
- [ ] Refactor — no behavior change (`refactor:`)
- [ ] Documentation (`docs:`)
- [ ] CI / tooling (`ci:` / `chore:`)
- [ ] Performance (`perf:`)
- [ ] Security

## Breaking change

- [ ] This PR introduces a breaking change (API contract, env var, DB schema, Docker image tag)

If checked, describe what breaks and the migration path:

## Verification

Tick everything you ran locally:

- [ ] `pnpm typecheck` (or `pnpm --filter <pkg> typecheck`)
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Manual smoke (describe below)

```
# paste the output of the most relevant verification step
# for API routes: include curl example + /readyz response
```

## Screenshots

For frontend changes, include before/after screenshots or a screen recording.

| Before | After |
| --- | --- |
| | |

## ADR reference

If this PR makes an architectural decision, link the ADR:

- ADR: docs/adr/NNNN-...

## Notes for reviewers

Anything tricky, intentional trade-off, follow-up work to track, etc.

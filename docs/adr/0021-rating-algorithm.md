# 21. Rating algorithm: Glicko-2

Date: 2026-05-19

## Status

Accepted.

## Context

LeetRank needs a per-user skill rating that updates after each contest. Two questions sit underneath:

1. Which algorithm fits a competitive-programming platform with **sparse, bursty** participation? Most users compete in fewer than two contests per quarter.
2. How do we represent uncertainty for new accounts so we don't reward (or penalise) them disproportionately?

Three candidate systems were evaluated.

| System | Pros | Cons |
|--------|------|------|
| **Elo** (1960) | Simple, universally understood, single scalar per user | No uncertainty model — a brand-new player and a 1000-game veteran are treated identically. Heavy bias against rating drift after long inactivity. |
| **Glicko** (1995) | Adds rating deviation (σ) on top of rating; new players have wide bands | Doesn't model rating *volatility* — sudden skill changes converge slowly. |
| **Glicko-2** (2012) | Adds volatility on top of Glicko; well-suited to bursty competition | Slightly more complex; two-parameter system. |
| **TrueSkill** | Strong for team / multi-player matches | Designed for `N`-player games; overkill for our 1-vs-N contest model. Patent caveats. |

Codeforces uses a customised Elo with rating-floor heuristics. CodeChef switched from Elo to a Glicko/Elo hybrid in 2020 specifically because Elo punished long-inactive contestants too aggressively. LeetCode uses a custom system that Wikipedia's reverse-engineering describes as Glicko-like.

## Decision

Adopt **Glicko-2** as the canonical rating algorithm for LeetRank.

Per user we store three values:

| Field | Type | Description | Initial value |
|-------|------|-------------|---------------|
| `rating` | `int` | Skill estimate (Glicko `μ` mapped to a friendly 1500-centred scale) | `1500` |
| `ratingDeviation` (RD) | `int` | One-sigma uncertainty band, in rating points | `350` |
| `ratingVolatility` | `float` | Per-user σ' tuning constant | `0.06` |

Update flow per contest:

1. Collect every contest entry that finished (`Contest.endsAt` past).
2. Construct virtual head-to-head matches: each entry plays everyone else, with a 1.0 / 0.5 / 0.0 score reflecting standing (Glicko-2's pairwise model handles `N`-way contests cleanly via this reduction).
3. Run the Glicko-2 update equations against each entry. Rating system constant `τ = 0.5` (the conservative end of the recommended `0.3 – 1.2` band).
4. Persist new `rating`, `ratingDeviation`, `ratingVolatility`. Append a `RatingChange` row for the rating timeline.
5. Recompute Redis sorted-set scores so the leaderboard reflects the new ratings (see [ADR 0022](0022-leaderboard-caching-strategy.md)).

Inactive-user RD inflation runs as a daily cron: any user that hasn't entered a contest in the last 30 days has their RD nudged up via the standard Glicko-2 RD growth formula. This guarantees a stale rating is treated with appropriate uncertainty when the user returns.

## Consequences

**Positive:**

- New accounts have a wide RD (350) and converge fast — three contests is usually enough to land within ±50 points of true skill.
- Volatility lets a genuinely improving user climb without fighting the system. A user dropping out for six months returns with inflated RD, so their first contest barely moves rating peers but rapidly recalibrates their own.
- Single canonical algorithm, well-published reference implementation. We can validate against [Glickman's reference paper](http://www.glicko.net/glicko/glicko2.pdf).

**Negative:**

- Three fields per user instead of one. Schema migration adds two columns and a backfill.
- The pairwise reduction is `O(N²)` per contest. With ~10 000-entry contests we still budget under 30 s; a smarter `O(N)` direct-N-way update is possible but mathematically harder to verify.
- Volatility introduces a second knob ops can mistune. We pin `τ = 0.5` and don't expose it to ops.

**Neutral:**

- The visible rating UI is still a single integer, identical to Elo from the user's perspective.

## Implementation notes

- Reference implementation: vendored Go port (`internal/rating/glicko2.go`) with table-driven tests against the values published in Glickman's example walkthrough.
- Recompute happens in the contest-finalise worker, not inline. Failure to recompute does **not** block contest visibility — the worker retries with exponential backoff.
- Store both pre- and post-contest snapshots per user so the rating timeline survives algorithm tuning.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Elo | No uncertainty model, hostile to bursty competition. |
| Glicko (v1) | No volatility; converges too slowly after a skill change. |
| TrueSkill | Designed for team play; patent caveats; mathematical complexity exceeds need. |
| Custom hybrid (Codeforces-style) | Reinvents prior art; auditing correctness is harder than vendoring Glickman's reference. |

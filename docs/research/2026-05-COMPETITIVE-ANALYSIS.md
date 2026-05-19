# Competitive feature analysis: LeetRank vs LeetCode, HackerRank, Codeforces, AtCoder

- Date: 2026-05-19
- Author: Nguyen Tien Son
- Status: Internal research note. Not a roadmap commitment.
- Scope: Identify product gaps that move user value and engagement, ranked. Propose five concrete next-sprint actions, each grounded in an existing LeetRank ADR.

> **Source-fetch note (2026-05-19).** The Codeforces help page, LeetCode Explore, LeetCode Study Plan hub, and AtCoder posts page returned `HTTP 403 Forbidden` to the agent's `WebFetch`. The HackerRank skills-verification page and one AtCoder announcement returned partial content. Where a primary source could not be retrieved, the entry is marked **"fetch unavailable, using cached knowledge as of training cutoff (Jan 2025)"**. Each fetched URL records `date-accessed: 2026-05-19`.

---

## 1. LeetRank shipped feature inventory (Phase 0 - Phase 3.1.5)

Cross-referenced from `README.md`, `prisma/schema.prisma` (13 models), `src/app/**` routes, `src/app/api/**` endpoints, and ADRs 0001-0032.

### 1.1 Solving and judging

1. **Problem catalogue** — 100+ seed problems. Markdown statements, sample I/O, visible test cases, slug routing. Source: `src/app/problems/[slug]`, `prisma:Problem`.
2. **Online judge with 30+ languages** — Python, Go, Rust, C/C++, Java, Kotlin, Scala, JS/TS, Ruby, PHP, C#, Lua, R, SQL. Per-submission **nsjail** isolation (Linux NS + cgroups + seccomp + cap drop). ADR 0003, ADR 0020.
3. **Run-code (no submit)** — `/api/run-code` for ad-hoc evaluation against stdin without persisting a submission row.
4. **Test cases** — visible + hidden split via `prisma:TestCase.isHidden`.
5. **Submission lifecycle** — list, detail, recent. `src/app/api/submissions/{[id], recent, route.ts}`. Verdict stream over Redis pubsub.
6. **Submission verdict streaming via WebSocket** — `services/realtime-go` (gorilla/websocket) fans out judge events.
7. **Per-language sandbox concurrency bounds** — ADR 0009.

### 1.2 Identity

8. **Auth API (Go)** — register, login, me, logout, change-password, profile, sessions. Sole canonical JWT issuer. `services/auth-go` (port 4011). ADR 0016, 0017, 0027.
9. **JWT with JOSE + Ed25519 JWKS verify** — web tier verify-only, identity service signs. ADR 0004, 0030.
10. **Service-to-service auth** — Ed25519 signed inter-service JWTs. ADR 0013.

### 1.3 Competition and ranking

11. **Contests** — time-boxed, `Contest` + `ContestProblem` + `ContestEntry` models. `src/app/contests/[slug]`. `/api/contests/{active,upcoming,[slug]}`.
12. **Leaderboards** — global, per-contest. `services/leaderboard-rust` (port 4015) over Redis ZSET, Postgres source-of-truth. ADR 0022.
13. **Around-me leaderboard** — `ZREVRANGEBYSCORE` window. ADR 0022.
14. **Glicko-2 rating** — per-user `rating`, `ratingDeviation`, `ratingVolatility`. RD inflation cron for inactive users. ADR 0021.
15. **Rating timeline** — `RatingChange` audit row per contest finalise.

### 1.4 Community

16. **Discussions** — per-problem threads (`Discussion` + `DiscussionComment`). Markdown, code blocks. `src/app/discussions/[id]`.
17. **Bookmarks** — per-user pinned problems. `prisma:Bookmark`, `/api/bookmarks`.
18. **n8n-orchestrated chatbot** — hint and concept assistant. `prisma:ChatMessage`, `/api/chat`. ADR 0015, 0019.
19. **Public profiles** — `/users/[username]`. Solved/attempted history, rating timeline, contest record, language mix.

### 1.5 Discovery and admin

20. **Tags** — `prisma:Tag` + `ProblemTag`. `/tags` page. `/api/problems/by-tag`.
21. **Trending + random problem endpoints** — `/api/problems/trending`, `/api/problems/random`.
22. **Global search** — `/api/search`.
23. **Admin panel** — users, problems, contests, discussions, stats, cache invalidation. `/admin`, `/api/admin/*`.
24. **Public status page** — `/status`. Live service health.
25. **Stats and metrics endpoints** — `/api/stats`, `/api/metrics` (Prometheus scrape).
26. **API docs page** — `/api-docs` rendering `apps/api/openapi.yaml` and `services/auth-go/openapi.yaml`.

### 1.6 Frontend craft

27. **Monaco editor with dynamic import** — language-aware autocomplete, themes, shortcuts. ADR 0010.
28. **Internationalisation** — cookie-based locale, English + Vietnamese. ADR 0031.
29. **Dashboard** — solved heat-ish view, settings, bookmarks. `/dashboard`.

### 1.7 Platform

30. **Polyglot microservices** — 10 backend services across Hono/TS, Go, Rust, Ruby, Python; container-first; dual-publish to Docker Hub + GHCR; SBOM; Trivy + Gitleaks + CodeQL CI lanes. ADRs 0011, 0018, 0024, 0026, 0028, 0029.

---

## 2. Competitor research

### 2.1 LeetCode

- **Source attempted:** `https://leetcode.com/study-plan/` (date-accessed 2026-05-19) - **fetch unavailable (HTTP 403)**, using cached knowledge as of training cutoff (Jan 2025).
- **Source attempted:** `https://leetcode.com/explore/` (date-accessed 2026-05-19) - **fetch unavailable (HTTP 403)**, using cached knowledge as of training cutoff.

Feature surface as of training cutoff:

| Feature | Description |
|---|---|
| **Problem catalogue** | ~3,000 problems across Algorithms, Database (SQL), Shell, Concurrency, JavaScript, Pandas tracks. |
| **Daily Challenge** | One problem per day, awards LeetCoins, drives a streak counter and an activity heatmap on the profile. |
| **Study Plan v2** | Curated paths: Top Interview 150, LeetCode 75, SQL 50, Pandas 50, Programming Skills, Top Liked, Graph Theory, Dynamic Programming, plus company-specific (Premium). Stamped progress per plan, not just per problem. |
| **Contests** | Weekly Contest (Sunday) and Biweekly Contest (Saturday), 4 problems each, 90 min, rated. Custom Elo-like rating displayed on profile. Contest Hall of Fame for top finishers. |
| **Premium tier** | Company tag filter, sort-by-frequency, video solutions, official editorial, debugger, mock interview by company, premium-only problems, expanded statistics. |
| **Editorial** | First-party written walkthrough per problem, premium-gated for newer problems. Includes complexity analysis and reference solutions per language. |
| **Discuss** | Per-problem threads, plus a global Discuss board, comment voting, pinned posts. |
| **Submission analytics** | Runtime and memory beats-percentile vs all submissions in the same language; histogram chart. |
| **Code playback** | Premium feature, replays the user's keystrokes during a session for review. |
| **Streaks and heatmap** | GitHub-style 365-day calendar of solved problems per user. |
| **Mock interview** | Timed simulated rounds, premium grade includes company-tagged sets. |
| **Built-in debugger** | Step-through debugger inside the editor, premium-gated. |
| **Companies and Topics tags** | Filter problems by interview frequency at named companies (premium) and by algorithmic topic (free). |

### 2.2 HackerRank

- **Source:** `https://www.hackerrank.com/skills-verification` (date-accessed 2026-05-19) - **fetch partial**, only certifications surface returned. Other features sourced from cached knowledge as of training cutoff (Jan 2025).

| Feature | Description |
|---|---|
| **Skill domains** | Algorithms, Data Structures, Mathematics, AI/ML, Databases, Linux Shell, Functional Programming, Regex, SQL, Java, Python, C++, Ruby, Distributed Systems, Security. |
| **Tracks ("Prepare")** | Linear ordered series, e.g., "30 Days of Code", "10 Days of JavaScript", "10 Days of Statistics". Each day unlocks a problem and a tutorial video. |
| **Skill Certifications** | Confirmed from fetch: Problem Solving (Basic/Intermediate), SQL (Basic/Intermediate/Advanced), JavaScript (Basic/Intermediate), Python (Basic), Java (Basic), Node.js (Basic/Intermediate), React (Basic), Angular (Basic/Intermediate), Go (Basic/Intermediate), R (Basic/Intermediate), C# (Basic), CSS (Basic), REST API (Intermediate). Issued as a shareable PDF and verifiable URL. |
| **Role Certifications** | Frontend Developer (React), Software Engineer, Software Engineer Intern. Multi-skill timed exam. |
| **Interview Preparation Kit** | Curated 70-problem path tagged by interview area (arrays, dictionaries, recursion, search, sorting, graphs, etc.). |
| **Projects** | Full-stack project assessments (REST API, React UI). |
| **Contests** | Site-wide and company-sponsored contests with leaderboards. |
| **HackerRank Jobs** | Performance on assessments visible to recruiters. |
| **Custom test input** | Run code against arbitrary stdin in the editor. |
| **Code review** | Community-comment threads on submissions. |

### 2.3 Codeforces

- **Source attempted:** `https://codeforces.com/help` (date-accessed 2026-05-19) - **fetch unavailable (HTTP 403)**, using cached knowledge as of training cutoff (Jan 2025).

| Feature | Description |
|---|---|
| **Rating system (Elo)** | Single integer rating with colour bands: gray (<1200), green (1200-1399), cyan (1400-1599), blue (1600-1899), purple (1900-2099), orange (2100-2399), red (2400-2599), nutty/legendary grandmaster (>=2600/3000). |
| **Contest divisions** | Div 1 (>=1900), Div 2 (<2100), Div 3 (<1600), Div 4 (<1400). Educational rounds (rated for Div 2). Global Rounds. ICPC-style and CF-Round formats. |
| **Virtual participation** | Replay any past contest under contest conditions. Solo, against the snapshot of original participants' submissions, no rating impact. |
| **Problem rating** | Each problem carries a numeric rating (e.g., 800-3500) computed from solver Elo distribution. |
| **Problem tags** | Topic taxonomy (dp, graphs, greedy, ...). Spoiler-hidden by default until solved. |
| **Gym** | Community-hosted past contests + ICPC archives, separate from main rated set, no rating impact. |
| **Hacking phase** | In Div 1/2 you can read other contestants' code post-contest and submit a counter-example test. Successful hack +100, failed -50. |
| **Polygon** | Problemsetting platform: testset authoring, validators, generators, model solutions, stress testing. |
| **Mashup** | Build a custom private contest from existing problemset entries, share by link. |
| **Groups** | Course/team management, private contests for class rosters. |
| **Blogs and comments** | Every user has a blog. Editorials usually shipped as a pinned blog post tagged to the contest. |
| **Stress testing** | Built-in checker patterns + brute-force compare. |
| **Catalog** | Curated study sequences by topic with linked problems. |

### 2.4 AtCoder

- **Source:** `https://atcoder.jp/posts/179` (date-accessed 2026-05-19) - partial single-event content. Other features sourced from cached knowledge as of training cutoff.

| Feature | Description |
|---|---|
| **Contest types** | ABC (Beginner, weekly Sat), ARC (Regular, ~monthly), AGC (Grand, ~quarterly), AHC (Heuristic, ~monthly, separate rating). |
| **Color tiers** | Gray <400, Brown <800, Green <1200, Cyan <1600, Blue <2000, Yellow <2400, Orange <2800, Red >=2800. Two horizontal stripes once you cross >=4000 / >=red levels. |
| **Dual ratings** | Algorithmic (ABC/ARC/AGC) and Heuristic (AHC) tracked separately. |
| **Problem difficulty** | Estimated per-problem difficulty (community tooling like AtCoder Problems site, official histogram). |
| **Editorial** | Shipped same day as contest end, multi-language. |
| **Practice / virtual** | Past contests can be replayed unrated. |

---

## 3. Gap analysis: top 12 missing features in LeetRank, ranked by user value

Effort key: S = <=1 sprint solo, M = 1-2 sprints with 1-2 contributors, L = >=2 sprints with cross-service work.

### Gap 1. Daily Challenge

- **Current LeetRank state:** No daily-pinned problem; users land on the catalogue and pick. No streak counter, no daily reward.
- **Target state:** One problem auto-selected per day visible on home, dashboard, and `/api/problems/daily`. Persists `DailyChallenge` and `UserDailyResult` rows. Streak counter on profile + 365-day heatmap.
- **Effort:** S
- **Competitor:** LeetCode "LeetCoding Challenge".
- **Source URL:** `https://leetcode.com/problemset/all/` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 2. Study Plans / curated learning paths

- **Current LeetRank state:** Tags + topic filtering exist, but no ordered, multi-week curriculum with per-step gating and progress tracking.
- **Target state:** `Plan` + `PlanStep` + `UserPlanProgress` models. Plan landing page lists "Top Interview 75", "SQL 50", "DP for beginners". Per-step lock/unlock. Profile shows enrolled plans.
- **Effort:** M
- **Competitor:** LeetCode Study Plan v2; HackerRank Tracks.
- **Source URL:** `https://leetcode.com/study-plan/` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 3. Contest divisions (Div 1/2/3/4)

- **Current LeetRank state:** All contests are flat. Glicko-2 rating exists but does not gate registration. New users compete head-to-head against red coders.
- **Target state:** Each `Contest` carries a `division` (`DIV1|DIV2|DIV3|DIV4|EDUCATIONAL|GLOBAL`) plus a `ratingCeiling`/`ratingFloor`. Registration enforces band. Editorial + leaderboard scoped per division.
- **Effort:** M
- **Competitor:** Codeforces.
- **Source URL:** `https://codeforces.com/help` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 4. Per-problem difficulty rating

- **Current LeetRank state:** `Problem.difficulty` is a 3-bucket enum (easy/medium/hard).
- **Target state:** Continuous numeric rating computed from solver Glicko-2 distribution at acceptance time. Exposed on the problem page next to the bucket. Recompute nightly via `analytics-python`. Stored on `Problem.numericRating` + history table.
- **Effort:** M
- **Competitor:** Codeforces problem rating.
- **Source URL:** `https://codeforces.com/problemset` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 5. Official editorial system

- **Current LeetRank state:** Discussions exist as community threads. No first-party walkthrough surface, no per-language reference solution, no complexity annotation.
- **Target state:** `Editorial` model linked 1:1 to `Problem`. Markdown body with sections (Approach, Complexity, Reference Solution per language). Render below the problem statement, gated until first AC or contest end. Authored by admins via `/admin/editorials`.
- **Effort:** M
- **Competitor:** LeetCode editorial; Codeforces editorial blog post.
- **Source URL:** `https://leetcode.com/explore/` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 6. Streaks + activity heatmap on profile

- **Current LeetRank state:** Profile shows solved/attempted history but no contiguous-day streak counter and no GitHub-style 365-day calendar.
- **Target state:** Daily aggregate row `UserActivity(userId, date, problemsSolved, submissions)` populated by submission post-commit hook. Profile renders SVG heatmap + current/longest streak.
- **Effort:** S
- **Competitor:** LeetCode profile heatmap; GitHub.
- **Source URL:** `https://leetcode.com/u/` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 7. Virtual contest participation

- **Current LeetRank state:** Past contests are read-only artefacts; users cannot replay them under contest timing.
- **Target state:** "Replay this contest" button on any concluded `Contest`. Spawns a `VirtualEntry(userId, contestId, startedAt)` with a personal countdown clock. Submissions evaluated against the original test set, but excluded from the contest leaderboard and rating. Optional shadow-rank against snapshot of original participants.
- **Effort:** M
- **Competitor:** Codeforces virtual participation; AtCoder virtual contests.
- **Source URL:** `https://codeforces.com/help` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 8. Submission analytics ("beats X% in language")

- **Current LeetRank state:** Submission detail shows verdict + runtime, but no comparative percentile vs other solvers.
- **Target state:** `analytics-python` precomputes per-problem-per-language runtime + memory histograms hourly. Submission detail page renders a small distribution chart and "beats N% in C++" strip.
- **Effort:** S
- **Competitor:** LeetCode runtime/memory beats.
- **Source URL:** `https://leetcode.com/problems/two-sum/submissions/` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 9. Skill certifications

- **Current LeetRank state:** No certification, no shareable PDF/URL artefact for skill claims.
- **Target state:** `Certification` catalogue (Problem Solving Basic/Intermediate, SQL Basic/Intermediate/Advanced, Python Basic, ...). Each is a timed multi-question session, auto-graded. Pass yields `UserCertification` row + signed PDF + permanent verification URL `/verify/<cert-id>`. PDF generation via `notifications-ruby` (already does outbound dispatch).
- **Effort:** L
- **Competitor:** HackerRank skill certifications.
- **Source URL:** `https://www.hackerrank.com/skills-verification` - date-accessed 2026-05-19 - fetched, partial.

### Gap 10. Hacking phase post-contest

- **Current LeetRank state:** No mechanism for users to read each other's contest code or counter-test.
- **Target state:** After a `Contest.endsAt`, a 12-hour `hackingWindow` opens. Reading other entries' code is allowed; submitting a new test case that flips an AC to WA awards the hacker +100 and overturns the original AC for the hacked entry. `Hack` model. Locked behind a Glicko RD floor to deter sock-puppet farming.
- **Effort:** L
- **Competitor:** Codeforces hacking phase.
- **Source URL:** `https://codeforces.com/help` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 11. Mashup / custom private contests

- **Current LeetRank state:** Only admins can create contests. Teams can't bundle existing problems into a private timed event.
- **Target state:** `/contests/new` accepts a list of existing `Problem` ids + duration + visibility (`PRIVATE_LINK|GROUP|PUBLIC`). Creates an unrated `Contest` with `kind = MASHUP`. No rating impact. Sharable join link.
- **Effort:** M
- **Competitor:** Codeforces mashups; LeetCode custom contests (premium).
- **Source URL:** `https://codeforces.com/mashup` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

### Gap 12. Company tags + interview-prep filter

- **Current LeetRank state:** Tags are topic-only (e.g., `dp`, `graphs`). No "asked at Google" or "Top Interview 150" filter surface.
- **Target state:** New `Company` model + `ProblemCompany` join with `frequency` int. Admin-curated. Adds a "Companies" filter on `/problems`. A reduced free version (without frequency counts) ships immediately; frequency rank is held back for a paid tier.
- **Effort:** S
- **Competitor:** LeetCode company tags (premium).
- **Source URL:** `https://leetcode.com/company/` - date-accessed 2026-05-19 - fetch unavailable, cached knowledge.

---

## 4. Top 5 next-sprint actions

Each action is sized to be spawnable as an independent fix-team pull request. Architecture decisions cite the existing ADR they extend rather than re-litigate.

### Action A. Daily Challenge + streak heatmap (Gap 1 + Gap 6)

Bundled because both share the same `UserActivity` aggregate and the daily problem feeds the streak counter.

**Architecture grounding.** Extends ADR 0022 (leaderboard caching): the same Redis-as-cache + Postgres-as-truth pattern applies to the daily-problem lookup. Extends ADR 0007 (Redis primitive use) by adding one fixed-TTL `STRING` per day (`daily:YYYY-MM-DD`).

**Data model.**

```prisma
model DailyChallenge {
  date       DateTime @id @db.Date
  problemId  String
  problem    Problem  @relation(fields: [problemId], references: [id])
  createdAt  DateTime @default(now())
}

model UserActivity {
  userId           String
  date             DateTime @db.Date
  problemsSolved   Int      @default(0)
  submissions      Int      @default(0)
  dailyAttempted   Boolean  @default(false)
  dailySolved      Boolean  @default(false)
  @@id([userId, date])
  @@index([userId, date(sort: Desc)])
}
```

**API.**

- `GET /api/problems/daily` -> `{ date, problem: ProblemSummary, userStatus: "not-attempted"|"attempted"|"solved" }` (auth-aware).
- `GET /api/users/{username}/activity?from=YYYY-MM-DD&to=YYYY-MM-DD` -> `[{date, count}]` (365-day window).
- `GET /api/users/{username}/streak` -> `{ current, longest, lastSolvedDate }`.
- Admin: `POST /api/admin/daily` (rotate next 30 days).

**UI.**

- New homepage card "Today's challenge" pinning the daily problem with a countdown to next rotation.
- `/dashboard` adds `<ActivityHeatmap>` (52-col x 7-row SVG) + `<StreakBadge current={...} longest={...} />`.
- Profile route `/users/[username]` mounts the same components.

**Tests.**

- Vitest unit: `dailyForDate(today)` returns the row, `dailyForDate(unseededDate)` 404s.
- Prisma seed integration: midnight rollover advances `daily:YYYY-MM-DD` Redis key.
- Playwright E2E: log in -> open `/`, see today's daily, click into it, submit AC, return to `/dashboard`, see streak count incremented and today's heatmap cell coloured.

### Action B. Contest divisions + rating-gated registration (Gap 3)

**Architecture grounding.** Extends ADR 0021 (Glicko-2): rating ceilings/floors read from the same `User.rating` field. No new rating math.

**Data model.**

```prisma
enum ContestDivision { DIV1 DIV2 DIV3 DIV4 EDUCATIONAL GLOBAL UNRATED }

model Contest {
  // ...existing fields...
  division        ContestDivision  @default(GLOBAL)
  ratingFloor     Int?             // inclusive
  ratingCeiling   Int?             // exclusive (null = open above)
  ratingScope     String?          // "DIV2_ONLY", informational
}
```

**API.**

- `POST /api/contests/{slug}/register` rejects with `409 RATING_OUT_OF_BAND` if `User.rating` outside `[ratingFloor, ratingCeiling)`.
- `GET /api/contests/upcoming` accepts `?division=DIV2`.
- Admin form on `/admin/contests/new` adds the division dropdown + auto-populates floor/ceiling defaults (Codeforces-style: DIV2 < 2100, DIV3 < 1600, DIV4 < 1400).

**UI.**

- `/contests` filter chip row: All | Div 1 | Div 2 | Div 3 | Div 4 | Educational | Global.
- Contest card badge with the division colour token.
- Contest detail shows "You're rated 1432 - eligible to register for Div 3 or Div 4" or the equivalent block.

**Tests.**

- Unit: `eligibleDivisionsFor(rating)` table-driven.
- Integration: registration request below floor returns 409 with the right code.
- Playwright: a low-rated user sees Div 1 register button disabled and tooltip "rating below 1900".

### Action C. Per-problem numeric rating + difficulty histogram (Gap 4)

**Architecture grounding.** Extends ADR 0021 (rating algorithm) - reuses the same Glicko-2 fields on `User`. New compute lives in `analytics-python` (already the heavy-compute service).

**Data model.**

```prisma
model Problem {
  // ...existing fields...
  numericRating         Int?     // 800..3500
  numericRatingComputedAt DateTime?
}

model ProblemRatingHistory {
  id         String   @id @default(cuid())
  problemId  String
  numericRating Int
  basedOnSolverCount Int
  computedAt DateTime @default(now())
  @@index([problemId, computedAt(sort: Desc)])
}
```

**Compute.**

`analytics-python` cron at 03:15 UTC nightly:

1. For each problem with >=20 distinct solvers, fetch the rating distribution of users with at least one AC.
2. Numeric rating = clamp(percentile(solver-rating, p=20), 800, 3500). 20th-percentile mirrors Codeforces' "if a 20th-percentile solver finds it solvable, that's the bar".
3. Write `Problem.numericRating` + append `ProblemRatingHistory` row.

**API.**

- `GET /api/problems/{slug}` adds `numericRating: number | null` and `numericRatingHistory: [{computedAt, numericRating}]` (last 30).
- `GET /api/problems?ratingMin=1200&ratingMax=1500` filter.

**UI.**

- Problem header: existing `<DifficultyBadge>` gains a small grey number "1432" next to the bucket label, with a tooltip explaining methodology.
- `/problems` filter sidebar adds a numeric-range slider.

**Tests.**

- pytest in `services/analytics-python` for the percentile computation against a fixture solver distribution.
- Vitest contract test that the API surfaces `numericRating` as nullable.
- Playwright: filter slider 1200-1500 returns only problems whose visible rating sits in that band.

### Action D. Curated study plans (Gap 2)

**Architecture grounding.** Extends ADR 0028 (hot-path indexes): plan listings need the same `(userId, plan)` covering index pattern as the leaderboard. No new infrastructure.

**Data model.**

```prisma
model Plan {
  id          String   @id @default(cuid())
  slug        String   @unique
  title       String
  description String
  coverUrl    String?
  isPremium   Boolean  @default(false)
  steps       PlanStep[]
}

model PlanStep {
  id        String  @id @default(cuid())
  planId    String
  plan      Plan    @relation(fields: [planId], references: [id])
  position  Int
  problemId String
  unlockRequiresPriorStep Boolean @default(true)
  @@unique([planId, position])
}

model UserPlanProgress {
  userId    String
  planId    String
  stepId    String
  state     String  // "locked" | "unlocked" | "completed"
  updatedAt DateTime @updatedAt
  @@id([userId, stepId])
  @@index([userId, planId])
}
```

**API.**

- `GET /api/plans` -> list (with auth-aware enrolment status).
- `GET /api/plans/{slug}` -> plan + ordered steps + per-step user state.
- `POST /api/plans/{slug}/enrol` and `POST /api/plans/{slug}/leave`.
- Submission post-commit hook: if AC and `submission.problemId` matches an unlocked step in any active plan, mark the step `completed` and the next one `unlocked`.

**UI.**

- `/plans` index card grid.
- `/plans/[slug]` linear step list with lock icons + per-step status.
- Profile shows "In progress" plans with a percentage bar.

**Tests.**

- Unit: state-machine `transition(plan, currentState, ACEvent)`.
- Integration: AC on step 3 of a 5-step plan flips step 4 from `locked` to `unlocked`.
- E2E: enrol, solve first problem, see step-2 unlock animation.

### Action E. Submission "beats X% in language" analytics (Gap 8)

**Architecture grounding.** Extends ADR 0024 (observability stack): the same Prometheus pipeline that already records `submission_runtime_ms{language}` is extended into a percentile-bucket cache. Extends ADR 0007 (Redis): one `ZSET` per `(problemId, language)` storing recent runtimes for percentile lookup.

**Data model.**

No schema change. Two Redis keys per (problem, language):

- `runtime:p:{problemId}:l:{language}` - sorted set, score = runtimeMs, member = submissionId. Capped to last 5000 AC submissions via `ZREMRANGEBYRANK`.
- `memory:p:{problemId}:l:{language}` - same shape.

**API.**

- `GET /api/submissions/{id}` response gains `analytics: { runtimeBeatsPct, memoryBeatsPct, sampleSize }` when verdict is AC, else `null`.

**Compute path.**

When `submissions-go` writes a verdict and it's AC, it:

1. `ZADD` the runtime + memory ZSETs.
2. `ZREVRANK` the new entry to derive percentile.
3. Store `runtimeBeatsPct`, `memoryBeatsPct` on the submission row.

Cap eviction runs every 100 inserts to keep the ZSET bounded.

**UI.**

- Submission detail page: new `<BeatsBadge>` strip below verdict - "Runtime: 24 ms (beats 87% in C++)" with a small histogram visualisation.

**Tests.**

- Go unit test for `percentileFor(runtime, language)` against a seeded ZSET.
- Integration: submit 100 fast solutions in one language, then a slow one - last submission reports a low beats-percentile.
- Playwright: open a known fast AC, verify the badge renders and the percentile is in (0,100).

---

## 5. Out of scope for this report

- Pricing tier design and revenue model.
- Specific UI mocks (responsibility of design pass per the standard polish vocabulary).
- Multi-region rollout sequencing - covered in ADR 0023.

## 6. Verification log

- File: `docs/research/2026-05-COMPETITIVE-ANALYSIS.md`.
- Each external URL carries a `date-accessed: 2026-05-19` annotation.
- Where the agent's `WebFetch` was blocked (LeetCode, Codeforces, partial AtCoder), the entry says so explicitly and falls back to cached training knowledge as of Jan 2025.
- 12 gaps ranked, 5 actions sized; each action references one or more ADRs from `docs/adr/` (0007, 0021, 0022, 0024, 0028).


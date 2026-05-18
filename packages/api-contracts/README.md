# @leetrank/api-contracts

Shared Zod schemas and TypeScript types that define the wire format between `apps/api` and `apps/web`. Single source of truth — drift between the frontend and backend becomes a TypeScript error instead of a runtime surprise.

## Why this package exists

Before the FE/BE split ([ADR 0011](../../docs/adr/0011-split-backend-frontend.md)), the frontend and backend shared Prisma types directly. That coupling breaks once the API runs in a separate process. This package replaces it: the API imports schemas for request validation and response shaping; the web app imports the same schemas for response typing. One definition, two consumers, zero drift.

## Exports

### Primitives (enums)

| Export | Values |
|--------|--------|
| `difficultyEnum` | `"easy"` \| `"medium"` \| `"hard"` |
| `roleEnum` | `"user"` \| `"admin"` |
| `contestStatusEnum` | `"upcoming"` \| `"active"` \| `"ended"` |
| `submissionStatusEnum` | `"accepted"` \| `"wrong_answer"` \| `"runtime_error"` \| `"time_limit_exceeded"` |
| `languageEnum` | `"python"` \| `"javascript"` \| `"typescript"` \| `"ruby"` \| `"php"` \| `"bash"` \| `"go"` \| `"rust"` \| `"c"` \| `"cpp"` \| `"java"` \| `"kotlin"` \| `"csharp"` \| `"swift"` \| `"sql"` |

### Resource schemas

| Export | Description |
|--------|-------------|
| `publicUserSchema` | Public user profile (id, username, avatar, bio, createdAt) |
| `tagSchema` | Tag (id, name, slug) |
| `problemSummarySchema` | Minimal problem (id, title, slug, difficulty) |
| `leaderboardEntrySchema` | Rank + user + solved count |

### Endpoint envelopes

| Export | Endpoint |
|--------|----------|
| `problemListQuerySchema` | Query params for `GET /problems` |
| `problemListItemSchema` | One row in the problems list |
| `problemListResponseSchema` | `GET /problems` response (problems, total, page, limit) |
| `problemDetailSchema` | Full problem with test cases |
| `problemDetailResponseSchema` | `GET /problems/:slug` response |
| `trendingProblemSchema` | Problem + recentAccepted count |
| `trendingResponseSchema` | `GET /problems/trending` response |
| `randomProblemResponseSchema` | `GET /problems/random` response |
| `contestSchema` | Contest (id, slug, title, description, startTime, endTime, status) |
| `contestsListResponseSchema` | `GET /contests` response |
| `contestWithCountsSchema` | Contest + entry/problem counts |
| `contestsWithCountsResponseSchema` | `GET /contests` (with counts) response |
| `contestProblemEntrySchema` | Problem entry inside a contest |
| `contestDetailSchema` | Contest + problems list |
| `contestDetailResponseSchema` | `GET /contests/:slug` response |
| `tagDetailResponseSchema` | `GET /tags/:slug` response (tag + paginated problems) |
| `leaderboardTopResponseSchema` | `GET /leaderboard/top` response |
| `tagsResponseSchema` | `GET /tags` response |
| `statsResponseSchema` | `GET /stats` response (problems, contests, users, accepted) |
| `healthResponseSchema` | Health endpoint response (status, service, timestamp) |
| `errorResponseSchema` | Standard error envelope (`{ error: string }`) |

Every schema has a matching inferred TypeScript type exported under the same name without the `Schema` suffix (e.g. `ProblemListResponse`, `ContestDetail`, `Difficulty`).

## Import patterns

```ts
// Validate an API response in the web app
import {
  problemListResponseSchema,
  type ProblemListResponse,
} from "@leetrank/api-contracts";

const data: ProblemListResponse = problemListResponseSchema.parse(json);

// Validate a query string in the API service
import { problemListQuerySchema } from "@leetrank/api-contracts";

const query = problemListQuerySchema.parse(c.req.query());

// Use an enum value
import { difficultyEnum, type Difficulty } from "@leetrank/api-contracts";

function isHard(d: Difficulty) {
  return d === difficultyEnum.enum.hard;
}
```

## Versioning policy

This package follows semver matched to the API version:

- **Patch** — add optional fields, tighten validation without breaking existing valid payloads.
- **Minor** — add new schemas or new required fields with defaults.
- **Major** — remove fields, rename schemas, or change field types in a breaking way.

Both `apps/api` and `apps/web` must be updated in the same PR when a breaking change lands.

## Adding a new schema

1. Edit `packages/api-contracts/src/schemas.ts` — add the Zod schema and export the inferred type.
2. Re-export from `packages/api-contracts/src/index.ts` if it is not already covered by `export * from "./schemas"`.
3. Update consumers — the TypeScript compiler will surface every call site that needs updating.

---

**Author:** Nguyễn Sơn — jasonbmt06@gmail.com — [@JasonTM17](https://github.com/JasonTM17)

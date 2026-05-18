# @leetrank/api-contracts

Wire-format contracts shared between `apps/api` and `apps/web`. Zod
schemas at `src/schemas.ts` mirror the OpenAPI spec at
[`docs/openapi.yaml`](../../docs/openapi.yaml).

## Why

Without a shared package, the backend's response shape and the frontend's
TypeScript types drift independently. A field rename on one side becomes a
runtime mismatch on the other. Consolidating both sides on the same Zod
schema means:

- Backend uses `schema.parse(input)` for request validation and
  `schema.parse(output)` as a self-check at the response boundary.
- Frontend uses `z.infer<typeof schema>` to get exact types — and can run
  the same schema as a runtime guard against bad responses if it wants.
- A schema change is a single PR that touches both consumers
  simultaneously; CI fails on either side until both align.

## Layout

```
packages/api-contracts/
├── src/
│   ├── index.ts       # Public surface — re-exports schemas
│   └── schemas.ts     # Zod definitions
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

```ts
// apps/api
import { leaderboardTopResponseSchema } from "@leetrank/api-contracts";

app.get("/leaderboard/top", async (c) => {
  const data = await computeTop();
  // The validate() at the boundary protects against accidental drift
  // between the prisma model and the contract.
  return c.json(leaderboardTopResponseSchema.parse({ leaderboard: data }));
});
```

```ts
// apps/web
import { leaderboardTopResponseSchema, type LeaderboardEntry } from "@leetrank/api-contracts";

const res = await fetch(`${API_BASE}/leaderboard/top`);
const json = leaderboardTopResponseSchema.parse(await res.json());
const entries: LeaderboardEntry[] = json.leaderboard;
```

## Status

This package is part of [ADR 0011](../../docs/adr/0011-split-backend-frontend.md)
phase 1. As more endpoints migrate from `apps/web/src/app/api/` to
`apps/api/src/`, their request/response schemas land here.

# How to add a new API route to `apps/api`

This guide walks through adding a route to the standalone Hono API service. Follow every step — skipping any one of them leaves the route undocumented, untested, or invisible to the frontend client.

---

## 1. Decide the route shape

Answer these questions before writing any code:

- **Read or write?** GET routes are read-only and can carry `Cache-Control` headers. POST/PUT/PATCH/DELETE routes mutate state and must be authenticated.
- **Auth required?** If yes, the handler must verify the JWT from the `leetrank_session` cookie using `packages/auth-verify`. Unauthenticated requests return `401`.
- **What does the response look like?** Sketch the JSON shape before touching the schema file.

---

## 2. Add Zod schemas to `packages/api-contracts/src/schemas.ts`

Every route needs at least two schemas: one for the query/body input and one for the response envelope.

```ts
// packages/api-contracts/src/schemas.ts

// Input (query params or request body)
export const myFeatureQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});
export type MyFeatureQuery = z.infer<typeof myFeatureQuerySchema>;

// Response envelope
export const myFeatureResponseSchema = z.object({
  items: z.array(myItemSchema),
  total: z.number().int().nonnegative(),
});
export type MyFeatureResponse = z.infer<typeof myFeatureResponseSchema>;
```

Export the types from `packages/api-contracts/src/index.ts` so the frontend can import them.

---

## 3. Create the handler in `apps/api/src/routes/<feature>.ts`

Mirror the pattern in `apps/api/src/routes/leaderboard.ts`:

```ts
// apps/api/src/routes/my-feature.ts
import type { Context } from "hono";
import { prisma } from "../db.js";
import { myFeatureQuerySchema } from "@leetrank/api-contracts";

export async function myFeatureHandler(c: Context) {
  const query = myFeatureQuerySchema.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams)
  );
  if (!query.success) {
    return c.json({ error: "Invalid query parameters" }, 400);
  }

  try {
    const { page = 1, limit = 20 } = query.data;
    // ... database query ...
    return c.json({ items, total });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
}
```

Keep handlers thin: validate input, call a query function, return JSON. Business logic belongs in a helper function in the same file or a shared `lib/` module.

---

## 4. Register the handler in `apps/api/src/server.ts`

Import the handler and add the route. **Static sub-paths must be registered before catch-all params** — the comment in `server.ts` explains why.

```ts
// apps/api/src/server.ts
import { myFeatureHandler } from "./routes/my-feature.js";

// Register BEFORE any :param catch-alls on the same prefix
app.get("/my-feature", myFeatureHandler);
```

If the route has a slug parameter (e.g. `/my-feature/:id`), register any static sub-paths (e.g. `/my-feature/active`) above it.

---

## 5. Add tests in `apps/api/src/__tests__/<feature>.test.ts`

Mirror the pattern in `apps/api/src/__tests__/leaderboard.test.ts`. Every route needs at minimum:

- Happy path: correct status code and response shape.
- Empty result: returns `200` with an empty array, not `404`.
- Invalid input: returns `400` with an `error` field.
- Auth-required routes: returns `401` when no cookie is present.

```ts
// apps/api/src/__tests__/my-feature.test.ts
import { describe, it, expect } from "vitest";
import { app } from "../server.js";

describe("GET /my-feature", () => {
  it("returns 200 with items array", async () => {
    const res = await app.request("/my-feature");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });
});
```

---

## 6. Update `apps/api/README.md` endpoint table

Add a row to the endpoints table:

```markdown
| `/my-feature` | GET | implemented |
```

---

## 7. Update `docs/openapi.yaml`

Add a path entry following the existing patterns in the file. The spec is served at `/api/openapi` and rendered at `/api-docs` via Swagger UI.

```yaml
/my-feature:
  get:
    summary: List my feature items
    tags: [MyFeature]
    parameters:
      - name: page
        in: query
        schema: { type: integer, minimum: 1, default: 1 }
      - name: limit
        in: query
        schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
    responses:
      "200":
        description: OK
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/MyFeatureResponse"
```

---

## 8. Verify locally

```bash
# From the repo root
pnpm --filter @leetrank/api typecheck
pnpm --filter @leetrank/api test
pnpm --filter @leetrank/api build
```

All three must pass before opening a PR.

---

## 9. PR checklist

Include in your PR description:

- The output of `curl http://localhost:4000/readyz` (should return `{"status":"ok",...}`).
- A `curl` example for the new route with a real response.
- An ADR reference if the route introduces a new architectural pattern.

---

*LeetRank — a learning project by Nguyễn Sơn (jasonbmt06@gmail.com). Feedback and questions welcome via email or [GitHub Issues](https://github.com/JasonTM17/LeetRank_Project/issues).*

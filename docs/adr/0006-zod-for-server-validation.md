# 0006. Zod for Server-Side Validation

Date: 2026-05-17
Status: Accepted

## Context

LeetRank has multiple API boundaries where untrusted input arrives: user registration, login, problem creation, code execution, and submission. Client-side validation improves UX but is trivially bypassed — any curl request skips it entirely. Server-side validation must be authoritative.

TypeScript's type system is erased at runtime; a typed function parameter provides no runtime guarantee about the shape of data arriving over HTTP. Without explicit validation, malformed requests can cause Prisma errors, unexpected behaviour in the judge service, or security issues.

## Decision

Use **Zod** (v3, `zod` in `package.json`) for runtime validation at every API boundary. All schemas are co-located in `src/lib/validations.ts` and imported by the relevant API route handlers. Current schemas:

- `registerSchema` — username format, email, password length
- `loginSchema` — email, password presence
- `createProblemSchema` — title, slug (lowercase-hyphen regex), difficulty enum, optional fields
- `runCodeSchema` — code, language enum (`python | javascript | go | ruby`), test cases array
- `submitCodeSchema` — code, language enum, problemId

The language enum in `runCodeSchema` and `submitCodeSchema` mirrors the supported languages in `judge-service/main.go`, keeping the two services in sync.

## Consequences

- **Easier:** Zod's `.parse()` / `.safeParse()` throws or returns typed errors with field-level messages. Schema types can be inferred with `z.infer<typeof schema>` to avoid duplicating TypeScript interfaces. Shared schemas in one file make it easy to audit all validation rules.
- **Harder:** Every new API route must import and call the relevant schema. Forgetting to validate is a silent omission — there is no framework-level enforcement.
- **Pattern:** Client-side validation (e.g. form field hints) is UX only and may use the same Zod schemas via `safeParse`, but the server always re-validates independently.

## Alternatives considered

- **`joi`** — mature but not TypeScript-first; type inference requires extra wrappers.
- **`yup`** — similar to Zod but slower and less ergonomic for TypeScript inference.
- **Manual validation** — verbose, inconsistent, and easy to get wrong. Rejected.
- **`class-validator` + `class-transformer`** — decorator-based; requires `experimentalDecorators` and adds class boilerplate that doesn't fit the functional style of Next.js route handlers.

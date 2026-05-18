/**
 * @leetrank/api-contracts — single source of truth for the FE/BE wire format.
 *
 * The OpenAPI spec lives at the repo root in `docs/openapi.yaml`.
 * This package re-exports the Zod schemas that mirror the wire shapes so
 * both the api service (request validation) and the web app (response
 * typing) can import them from one place. Drift between FE and BE becomes
 * a TypeScript error instead of a runtime surprise.
 */

export * from "./schemas";

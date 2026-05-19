# 15. n8n-backed chatbot integration

Date: 2026-05-18

## Status

Superseded by [ADR 0019](0019-n8n-integration.md), which expands the n8n
integration beyond the chatbot-only scope captured here.

## Context

RULES §15 mandates n8n for workflow automation and chatbot features. The
platform needs an AI assistant that can answer questions about problems,
algorithms, and contest strategy. Two implementation paths were considered:

1. **Direct LLM call** — the Next.js route handler calls OpenAI (or another
   provider) directly.
2. **n8n webhook** — the route handler POSTs to an n8n workflow; n8n owns the
   LLM call, prompt construction, and any retry/branching logic.

## Decision

Use n8n as the chatbot backend (option 2).

The Next.js route at `/api/chat` persists messages to Postgres, applies rate
limiting, and forwards to `N8N_CHATBOT_WEBHOOK_URL`. n8n handles everything
downstream: prompt assembly, LLM provider selection, retries, and response
formatting.

## Rationale

**Why n8n over a direct LLM call:**

- **Decoupling.** Swapping LLM providers (OpenAI → Anthropic → local Ollama)
  requires zero code changes in the app — only the n8n workflow changes.
- **Retry and branching.** n8n's built-in error handling, retry nodes, and
  conditional branches handle transient LLM failures without custom code.
- **Observability.** n8n logs every execution with inputs/outputs. Debugging a
  bad reply means opening the n8n UI, not grepping server logs.
- **RULES §15 compliance.** The project rules explicitly require n8n for
  chatbot features.

**Why a per-message rate limit (10 req/min per user):**

- LLM calls are expensive. A per-user cap prevents a single user from
  exhausting the OpenAI quota or degrading response times for others.
- The in-process fixed-window limiter (`lib/rate-limit.ts`) is already
  present and sufficient for single-instance deployments. A Redis-backed
  limiter is the documented upgrade path for multi-instance.

**Why messages are persisted in Postgres:**

- History is sent to n8n on every request so the LLM has multi-turn context.
- Persisting to `ChatMessage` lets users reload history across sessions and
  enables future analytics (e.g. most-asked problem topics).

## What is deferred

| Feature | Reason |
|---|---|
| SSE streaming | Requires n8n streaming support + client EventSource; tracked as TODO in `chat-bot.tsx` |
| Code redaction beyond 200 lines | Current impl strips blocks > 200 lines; smarter AST-based redaction is a follow-up |
| Multi-turn agent loop | n8n workflow is single-turn for now; tool-calling / ReAct loop is a future workflow revision |
| Redis-backed rate limiter | Single-instance is fine for now; swap documented in `lib/rate-limit.ts` |
| Webhook secret auth | `X-Webhook-Secret` header auth between app and n8n is documented but not yet wired |
| n8n merged into root compose | `infra/n8n/docker-compose.snippet.yml` is a separate file; merge is a follow-up commit |

## Consequences

- A running n8n instance is required for the chatbot to function. If
  `N8N_CHATBOT_WEBHOOK_URL` is unset or n8n is unreachable, the route returns
  503 with `{ error: "Chatbot temporarily unavailable" }` — the rest of the
  app is unaffected.
- The `ChatMessage` Prisma model requires a migration before the feature is
  live: `npx prisma migrate dev --name add-chat-message`.
- Three new env vars are introduced: `N8N_CHATBOT_WEBHOOK_URL`, `N8N_USER`,
  `N8N_PASSWORD` (documented in `.env.example`).

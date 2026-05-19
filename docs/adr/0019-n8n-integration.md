# 19. n8n integration for chatbot and automation

Date: 2026-05-19

## Status

Accepted. Supersedes the implementation note in [ADR 0015](0015-n8n-chatbot.md), which captured the chatbot-only scope.

## Context

LeetRank needs three categories of automation that the core services intentionally do not own:

1. **Chatbot.** A conversational assistant that answers questions about problems, algorithms, and contest strategy.
2. **Notification fan-out.** Contest start reminders, "your friend solved a problem you tried" pings, weekly digest emails.
3. **Operational glue.** Periodic data exports, third-party integrations (Discord, Slack, Telegram), one-off ETL.

Three implementation paths were considered:

- **Direct, in-app code.** Add HTTP clients, LLM SDKs, schedulers, and provider-specific code to `apps/web` and the Go services. Every new integration ships through the regular review/release cycle.
- **Per-service worker daemons.** A bespoke Go binary per integration class (`notify-worker`, `chat-worker`, etc.).
- **n8n as the workflow runtime.** Self-hosted n8n container; LeetRank services emit webhooks; n8n owns LLM calls, retries, branching, third-party credentials.

## Decision

Standardise on **n8n as the canonical workflow runtime** for chatbot, notifications, and operational automation. LeetRank services emit signals (HTTP webhooks or Postgres `LISTEN/NOTIFY` channels) and treat n8n as a black box that handles delivery.

Concretely:

- Self-host the official `n8nio/n8n` container in compose. Persist workflows to a dedicated Postgres database (separate from the application DB).
- The web app's `/api/chat` route POSTs to `N8N_CHATBOT_WEBHOOK_URL`. n8n owns prompt construction, LLM provider selection, retries, and response shaping.
- Notifications emit to `N8N_NOTIFY_WEBHOOK_URL` with a typed payload. n8n routes per channel (Discord / email / Slack) based on workflow logic.
- Per-IP and per-user rate limits stay in the calling service — n8n is not a security boundary.
- Workflows live in the repo as JSON exports under `infra/n8n/workflows/` so they're version-controlled.

## Consequences

**Positive:**

- Swapping LLM providers (OpenAI → Anthropic → Ollama) needs zero code change in the app — only the workflow.
- Built-in retries, conditional branches, and execution history (UI-inspectable) without bespoke code.
- New integration channels (Telegram, Teams) ship as a workflow, not a release.
- Decouples LLM cost spikes from app deployment cadence — finance can throttle the workflow without an app rollback.
- RULES §15 compliance is automatic.

**Negative:**

- One more managed service to operate (n8n container + its Postgres).
- Workflow logic lives in n8n's UI/JSON, not in code review. We mitigate by checking workflows into git as JSON exports and reviewing them like code.
- A bad workflow can silently drop notifications. Add a synthetic ping every 5 minutes that alerts if n8n is unreachable.

**Neutral:**

- Workflows are still versioned, but the diff is JSON, not TypeScript. Reviewers must learn the n8n schema.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Direct LLM client in `apps/web` | Couples release cadence; provider lock-in. |
| Per-service Go workers | High implementation cost; reinvents retries, schedules, branching. |
| Temporal | Heavyweight; team has no Temporal experience; n8n covers 90% of needs at 10% of operational cost. |
| AWS Step Functions / GCP Workflows | Vendor lock-in incompatible with self-host requirement. |

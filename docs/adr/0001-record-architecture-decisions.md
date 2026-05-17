# 0001. Record Architecture Decisions

Date: 2026-05-17
Status: Accepted

## Context

As LeetRank grows, decisions about technology choices, design trade-offs, and structural patterns are made in pull requests, chat threads, or informally. Without a lightweight record, new contributors cannot understand why things are the way they are, and the team risks re-litigating settled questions.

We need a format that is:
- Low friction to write (plain Markdown, lives in the repo)
- Versioned alongside the code it describes
- Searchable and linkable

## Decision

We adopt Architecture Decision Records (ADRs) stored in `docs/adr/` using the MADR (Markdown Architectural Decision Records) template from https://adr.github.io/madr/.

Each ADR is a single Markdown file named `NNNN-<slug>.md` with a four-digit sequence number. Files are never deleted; superseded records are marked with `Status: Superseded by NNNN`.

Each ADR is landed in its own commit with message `docs(adr): <title>` so the git log doubles as a decision timeline.

## Consequences

- New contributors have a canonical place to look up "why Prisma?" or "why Go for the judge?"
- Writing an ADR is required for any significant technology addition or architectural change.
- The sequence number is append-only; gaps are acceptable if a draft is abandoned.
- Existing decisions are back-filled in this initial batch (ADRs 0001–0010).

## Alternatives considered

- **Confluence / Notion pages** — not versioned with the code; links rot.
- **RFC documents in `docs/rfcs/`** — heavier process, better suited to large teams.
- **Inline comments in code** — too scattered; no single place to browse decisions.

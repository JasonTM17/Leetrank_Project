# How to write an ADR

Architecture Decision Records (ADRs) are how LeetRank documents significant technical choices. See [ADR 0001](../adr/0001-record-architecture-decisions.md) for the rationale behind using ADRs.

---

## When to write an ADR

Write an ADR when you are:

- Choosing a technology, library, or service (e.g. "why Hono over Express?")
- Making a structural change that affects multiple services or teams
- Reversing or superseding a previous decision
- Documenting a trade-off that future contributors will need to understand

You do not need an ADR for bug fixes, routine dependency updates, or changes that are obviously reversible.

---

## Step 1 — Copy the template

```bash
cp docs/adr/template.md docs/adr/NNNN-<short-slug>.md
```

Where `NNNN` is the next available four-digit sequence number (check the existing files in `docs/adr/` to find it). The slug should be lowercase, hyphen-separated, and describe the decision in 3–5 words.

Examples:
- `0017-use-redis-for-rate-limiting.md`
- `0018-drop-graphql-in-favour-of-rest.md`

> If `docs/adr/template.md` does not exist yet, create it with the structure shown in Step 2 and commit it separately before writing your ADR.

---

## Step 2 — Fill in the sections

The template has four required sections:

```markdown
# NNNN. <Title>

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by NNNN

## Context

What is the situation that forces a decision? What constraints exist?
What problem are we solving?

## Decision

What did we decide to do? State it clearly and directly.

## Consequences

What becomes easier or harder as a result of this decision?
What are the known trade-offs?

## Alternatives considered

What other options were evaluated? Why were they rejected?
```

**Tips for each section:**

- **Context:** Write for a reader who has no background. Link to relevant issues, PRs, or external references.
- **Decision:** One or two sentences. Avoid hedging — "we decided to use X" not "we might consider X".
- **Consequences:** Be honest about downsides. An ADR that only lists upsides is not useful.
- **Alternatives considered:** At least two alternatives. Explain what ruled each one out.

---

## Step 3 — Open a PR with the ADR and the change it documents

The ADR and the code change it describes should land in the same PR. This keeps the git log coherent: the commit that introduces a new dependency also explains why.

Commit message format:

```
docs(adr): NNNN <title in sentence case>
```

Example:

```
docs(adr): 0017 use Redis for rate limiting
```

---

## Step 4 — Reviewer checklist

The reviewer should verify:

- Does the **Decision** section answer "what did we choose"?
- Does the **Context** section answer "why was a decision needed"?
- Does the **Consequences** section acknowledge real trade-offs, not just benefits?
- Does the **Alternatives considered** section link to or explain why alternatives were rejected?
- Is the ADR number unique and sequential?
- Is the status set to `Accepted` (not left as `Proposed`) before merge?

---

## Superseding an existing ADR

If a new decision reverses a previous one:

1. Update the old ADR's `Status` line to `Superseded by NNNN`.
2. In the new ADR's **Context** section, link to the old ADR and explain what changed.

Do not delete old ADRs. The history of decisions is as valuable as the decisions themselves.

---

*LeetRank — a learning project by Nguyễn Sơn (jasonbmt06@gmail.com). Feedback and questions welcome via email or [GitHub Issues](https://github.com/JasonTM17/LeetRank_Project/issues).*

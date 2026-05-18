# Privacy Policy

**Last updated:** 2026-05-18

---

## Who we are

LeetRank is a competitive programming platform built and operated by **Nguyễn Sơn** (GitHub: [@JasonTM17](https://github.com/JasonTM17)).

Contact: jasonbmt06@gmail.com

This is a learning project. It is not operated by a registered company.

---

## Data we collect

### Account data

When you register, we store:

- Email address
- Username
- Password (bcrypt hash — the plaintext is never stored or logged)
- Role (`user` or `admin`)
- Optional: avatar URL, bio

### Submission data

Every code submission stores:

- User ID (foreign key to your account)
- Problem ID
- Programming language
- Source code
- Verdict status, runtime (ms), memory (KB), stdout/stderr output
- Timestamp

Submission code is private to the author and admins. Public leaderboard and submission-count endpoints expose metadata only (status, language, timestamp) — not source code.

### Contest data

When you join a contest, we store a `ContestEntry` record containing your user ID, contest ID, score, rank, and join timestamp.

### Discussions and comments

Discussion posts and comments store your user ID, the problem they belong to, title, body text, upvote count, and timestamps.

### Bookmarks

Bookmarking a problem stores your user ID, the problem ID, and a timestamp.

### Chat messages

The in-platform chatbot stores each message with your user ID, the message content, an optional problem/contest context ID, the role (`user` or `assistant`), and a timestamp.

---

## Data we do NOT collect

- Passwords in plaintext — bcrypt hashes only.
- Full HTTP request bodies — the request logger records method, path, status, duration, request ID, and User-Agent only.
- Payment information — LeetRank does not accept payments.
- Advertising identifiers or cross-site tracking data.

---

## Cookies

LeetRank sets one cookie:

| Name | Purpose | Attributes |
| --- | --- | --- |
| `leetrank_session` | Stores a signed JWT that authenticates your session | `HttpOnly`, `SameSite=Lax`, `Secure` (production), 7-day expiry |

`HttpOnly` means JavaScript cannot read the cookie. `SameSite=Lax` blocks it from being sent on cross-site POST requests. `Secure` ensures it is only transmitted over HTTPS in production.

No analytics, advertising, or third-party tracking cookies are set.

See the full [Cookie Policy](./cookie-policy.md) for details.

---

## Logging

The API logs one structured line per HTTP request containing:

- HTTP method and path
- Route pattern (e.g. `/problems/:slug`)
- HTTP status code
- Duration in milliseconds
- Request ID (`x-request-id` header)
- User-Agent string

The following fields are **automatically redacted** before any log line is written: `password`, `passwd`, `token`, `authorization`, `auth`, `cookie`, `set-cookie`, `secret`, `jwt`, `api_key`, `apikey`, `session`. Accidental inclusion of these keys in a log call produces `[REDACTED]` in the output, not the value.

Logs are written to stdout and collected by the container runtime. They are not shipped to a third-party log aggregation service at this time.

---

## Third-party services

| Service | What it receives | Why |
| --- | --- | --- |
| Judge service (internal Go container) | Source code, language ID, test case inputs | Executes submitted code in a sandbox; receives no PII |
| n8n chatbot service | Message text, user ID | Powers the in-platform assistant; does not receive email, password, or submission code |

We do not share data with advertisers, analytics providers, or data brokers.

---

## Your rights (GDPR)

If you are in the European Economic Area, you have the right to:

- **Access** — request a copy of the data we hold about you.
- **Rectification** — ask us to correct inaccurate data.
- **Erasure** — ask us to delete your account and associated data.
- **Portability** — receive your data in a machine-readable format.

To exercise any of these rights, email jasonbmt06@gmail.com with the subject line "Privacy request — [your username]".

> Note: Self-service account deletion is tracked in the production-readiness audit (F-079) and is not yet implemented in the UI. Until it is, email the address above.

---

## Data retention

| Data type | Retention |
| --- | --- |
| Account (email, username, hashed password, profile) | Until you request deletion |
| Submissions | Kept indefinitely as part of leaderboard history |
| Contest entries | Kept indefinitely |
| Discussions and comments | Kept indefinitely |
| Bookmarks | Deleted when you delete your account |
| Chat messages | 30 days from creation |

> Note: Automated 30-day purge of chat messages is not yet enforced at the database level. This is a known gap tracked in the production-readiness audit.

---

## Security

- Passwords are hashed with **bcrypt** (cost factor 10).
- Session tokens are **JWT** signed with a secret that must be at least 16 characters; the server refuses to start in production without it.
- All traffic in production is served over **HTTPS** via Caddy with Let's Encrypt certificates and HSTS headers.
- The judge sandbox has no network access and runs with per-language blocklists for dangerous system calls and imports.

See [SECURITY.md](../../SECURITY.md) for the full hardening inventory and vulnerability reporting process.

---

## Changes to this policy

We will update the "Last updated" date at the top of this file when the policy changes. Significant changes will be noted in [CHANGELOG.md](../../CHANGELOG.md).

---

*LeetRank — a learning project by Nguyễn Sơn (jasonbmt06@gmail.com). Feedback and questions welcome via email or [GitHub Issues](https://github.com/JasonTM17/LeetRank_Project/issues).*

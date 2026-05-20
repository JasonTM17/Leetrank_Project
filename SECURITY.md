# Security Policy

🌐 **English** · [Tiếng Việt](SECURITY.vi.md)

## Supported Versions

| Version | Supported          | Notes                          |
| ------- | ------------------ | ------------------------------ |
| 0.2.x   | :white_check_mark: | Active development on `main`   |
| 0.1.x   | :warning:          | Critical fixes only            |
| < 0.1   | :x:                | End of life                    |

We support the latest minor release on `main` plus the immediately previous minor for critical security patches only.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security reports.** Instead,
email **jasonbmt06@gmail.com** with:

- A description of the issue and its impact (auth bypass, RCE, data exposure,
  denial of service, etc.).
- Steps to reproduce, ideally a minimal proof of concept.
- The commit SHA or version you tested against.
- Any relevant logs, headers, or payloads (sanitize secrets before sending).

You will receive an acknowledgement within **72 hours**. Expect an initial
triage and either a confirmation, a request for clarification, or a
"working as intended" response within **7 days**.

## Disclosure Process

1. Report received and acknowledged.
2. Issue reproduced privately.
3. Fix developed and reviewed on a private branch.
4. Coordinated disclosure date agreed with the reporter when applicable.
5. Patch merged to `main`, advisory published in `CHANGELOG.md` and a GitHub
   Security Advisory if the impact warrants one.

Please give us a reasonable window — typically 30 days for high-impact
issues — before public disclosure.

## Scope

In scope:

- LeetRank web application (`src/`)
- Judge service (`judge-service/`) including sandbox bypasses
- Authentication, authorization, and session handling
- Container images and `docker-compose` configuration shipped from this repo

Out of scope:

- Vulnerabilities in third-party dependencies (please report upstream first;
  open an issue here once a CVE is public).
- Self-XSS that requires the victim to paste attacker-controlled JavaScript
  into the browser console.
- Best-practice findings without a demonstrable impact (e.g. missing security
  headers on static asset paths).

## Hardening Already in Place

- JWT_SECRET fail-fast in production (`src/lib/auth.ts`)
- httpOnly cookies for session tokens, SameSite=lax
- bcrypt password hashing (cost 10)
- Per-IP rate limiting on `/api/auth/login` and the judge `/execute` endpoint
- Per-language sandbox blocklists in the judge runners
- Global + per-IP concurrency caps on the judge to absorb burst load
- Zod validation on every request body that touches the database

## Credit

Researchers who report responsibly will be credited in `CHANGELOG.md` unless
they request anonymity.

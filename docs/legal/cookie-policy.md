# Cookie Policy

**Last updated:** 2026-05-18

---

## What are cookies?

Cookies are small text files stored in your browser by a website. LeetRank uses cookies only for authentication — nothing else.

---

## Cookies we set

### Essential cookies

| Name               | Purpose                                                    | Duration | Attributes                                             |
| ------------------ | ---------------------------------------------------------- | -------- | ------------------------------------------------------ |
| `leetrank_session` | Stores a signed JWT that identifies your logged-in session | 7 days   | `HttpOnly`, `SameSite=Lax`, `Secure` (production only) |

This cookie is **required** for the platform to work. Without it, you cannot log in or access any authenticated page.

`HttpOnly` prevents JavaScript from reading the cookie value, protecting against XSS token theft. `SameSite=Lax` blocks the cookie from being sent on cross-site POST requests, mitigating CSRF. `Secure` ensures the cookie is only transmitted over HTTPS in production.

---

## Cookies we do NOT set

- Analytics cookies (no Google Analytics, Plausible, or similar)
- Advertising or tracking cookies
- Third-party cookies of any kind

---

## Third-party cookies

No third-party scripts or iframes are loaded that would set cookies in your browser.

---

## How to disable cookies

You can block or delete cookies through your browser settings:

- **Chrome:** Settings > Privacy and security > Cookies and other site data
- **Firefox:** Settings > Privacy & Security > Cookies and Site Data
- **Safari:** Preferences > Privacy > Manage Website Data
- **Edge:** Settings > Cookies and site permissions

If you disable the `leetrank_session` cookie, you will not be able to log in. All other platform features that require authentication will be unavailable.

---

## Contact

Questions about this policy: jasonbmt06@gmail.com

---

_LeetRank — a learning project by Nguyễn Sơn (jasonbmt06@gmail.com). Feedback and questions welcome via email or [GitHub Issues](https://github.com/JasonTM17/Leetrank_Project/issues)._

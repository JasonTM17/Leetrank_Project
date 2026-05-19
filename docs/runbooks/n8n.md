# n8n chatbot runbook

This service powers the in-app coding assistant via an n8n workflow. The web
tier `POST /api/chat` route signs every outbound request with HMAC-SHA-256 so
the workflow can reject forged requests that hit the public webhook URL.

## Wire format

Outbound from web tier to n8n:

```
POST /webhook/leetrank-chatbot
Content-Type: application/json
X-LeetRank-Signature: <hex-encoded HMAC-SHA-256 of raw body>
```

Body schema:

```json
{
  "userId": "string",
  "problemId": "string?",
  "contestId": "string?",
  "message": "string",
  "history": [{ "role": "user" | "assistant", "content": "string" }]
}
```

The signature is computed against the exact raw body bytes that go on the
wire. Do not re-stringify the parsed JSON in n8n — the bytes will not match.

## Verification (n8n Code node)

Place this as the first node after the Webhook trigger. Reject the request
with a 401 when the signature is missing or does not match. Use a
constant-time comparison to avoid timing oracles.

```js
// Code node — runs in the n8n execution sandbox.
const crypto = require("node:crypto");

const secret = $env.N8N_HMAC_SECRET;
if (!secret) {
  throw new Error("N8N_HMAC_SECRET is not configured");
}

const sigHeader = $input.first().json.headers["x-leetrank-signature"];
const rawBody = $input.first().json.body; // n8n exposes the raw body here

if (!sigHeader || typeof rawBody !== "string") {
  return [{ json: { error: "missing signature" }, statusCode: 401 }];
}

const expected = crypto
  .createHmac("sha256", secret)
  .update(rawBody)
  .digest("hex");

const a = Buffer.from(sigHeader, "hex");
const b = Buffer.from(expected, "hex");

if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
  return [{ json: { error: "bad signature" }, statusCode: 401 }];
}

return $input.all();
```

If the workflow webhook node serialises the request body before the Code
node runs, configure the Webhook node's "Response Mode" so the raw body is
preserved. The signature is computed against the bytes the web tier sent —
any reformatting (whitespace, key reordering) breaks the comparison.

## Configuration

| Var                          | Where             | Purpose                                            |
|------------------------------|-------------------|----------------------------------------------------|
| `N8N_HMAC_SECRET`            | web tier env      | Used to sign outbound webhook calls                |
| `N8N_HMAC_SECRET`            | n8n environment   | Used by the verify Code node                       |
| `N8N_CHATBOT_WEBHOOK_URL`    | web tier env      | Workflow webhook endpoint                          |

The two `N8N_HMAC_SECRET` values MUST be identical. Generate with:

```sh
openssl rand -hex 32
```

Rotate by setting the new value in both places, then redeploying both. There
is no overlap window — a few hundred ms of mismatch returns 401 to the user
and the chat route surfaces a "Chatbot temporarily unavailable" message.

## Operations

- **Disabled HMAC in dev**: if `N8N_HMAC_SECRET` is empty in development,
  the web tier logs `[chat] N8N_HMAC_SECRET unset — skipping HMAC signing`
  once at first call and sends unsigned requests. The n8n verify node MUST
  reject unsigned requests in production. Production refuses to start with
  the secret unset.
- **Signature failures**: the chat route returns HTTP 503 to the user; n8n
  should log the bad signature with the request ID for forensics.
- **Webhook URL rotation**: changing the URL alone is not a security boundary
  — the URL leaks via SSRF, browser history, and CDN logs. Rotate the HMAC
  secret instead.

## References

- `src/app/api/chat/route.ts` — outbound signing
- `.env.example`, `.env.production.example` — `N8N_HMAC_SECRET`
- ADR 0015 — n8n chatbot
- ADR 0019 — n8n integration

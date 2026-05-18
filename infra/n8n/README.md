# n8n Chatbot Workflow

This directory documents the n8n workflow that powers the LeetRank AI assistant
(`/api/chat`). The Next.js route handler forwards user messages here; n8n handles
LLM orchestration, retries, and prompt construction.

---

## Workflow shape

```
[Webhook] → [Function: redact + build prompt] → [HTTP Request: LLM] → [Set: format reply] → [Respond to Webhook]
```

### 1. Webhook node

- **Path:** `/webhook/leetrank-chatbot`
- **Method:** POST
- **Authentication:** Header auth (`X-Webhook-Secret`) — set the same value in
  `N8N_WEBHOOK_SECRET` (app) and the n8n credential store.
- **Expected body:**
  ```json
  {
    "userId": "clxxx",
    "problemId": "clyyy",   // optional
    "contestId": "clzzz",   // optional
    "message": "How do I solve two-sum?",
    "history": [
      { "role": "user",      "content": "..." },
      { "role": "assistant", "content": "..." }
    ]
  }
  ```

### 2. Function node — redact + build prompt

Constructs the messages array for the LLM:

```js
const systemPrompt = `You are a helpful coding assistant for LeetRank, a competitive
programming platform. Help users understand algorithms, debug code, and learn
problem-solving strategies. Be concise and educational.`;

const history = $json.history ?? [];
const messages = [
  { role: "system", content: systemPrompt },
  ...history.slice(-10),   // cap context window
  { role: "user", content: $json.message },
];

return [{ json: { messages } }];
```

### 3. HTTP Request node — LLM call

- **URL:** `https://api.openai.com/v1/chat/completions` (or any OpenAI-compatible endpoint)
- **Method:** POST
- **Authentication:** Header auth — `Authorization: Bearer {{ $credentials.openAiApi.apiKey }}`
- **Body:**
  ```json
  {
    "model": "gpt-4o-mini",
    "messages": "={{ $json.messages }}",
    "max_tokens": 1024,
    "temperature": 0.7
  }
  ```

### 4. Set node — format reply

Extracts the assistant text and returns the shape the app expects:

```
reply = {{ $json.choices[0].message.content }}
```

Output: `{ "reply": "..." }`

### 5. Respond to Webhook node

- **Response body:** `{{ $json }}`
- **Status code:** 200

---

## Environment variables (n8n container)

| Variable | Description |
|---|---|
| `N8N_BASIC_AUTH_ACTIVE` | Enable basic auth for the n8n UI |
| `N8N_BASIC_AUTH_USER` | UI username |
| `N8N_BASIC_AUTH_PASSWORD` | UI password |
| `OPENAI_API_KEY` | Set in n8n credential store, not as env var |

---

## Example workflow export (placeholder)

A full workflow JSON export would be placed at `infra/n8n/leetrank-chatbot-workflow.json`
after exporting from a running n8n instance via:

```
Settings → Workflows → Export
```

The placeholder below shows the minimal structure. Import it via the n8n UI
(`Workflows → Import from file`) and fill in credentials.

```json
{
  "name": "LeetRank Chatbot",
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "leetrank-chatbot",
        "httpMethod": "POST",
        "responseMode": "responseNode"
      }
    },
    {
      "name": "Build Prompt",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// see §2 above"
      }
    },
    {
      "name": "Call LLM",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.openai.com/v1/chat/completions",
        "method": "POST"
      }
    },
    {
      "name": "Format Reply",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [{ "name": "reply", "value": "={{ $json.choices[0].message.content }}" }]
        }
      }
    },
    {
      "name": "Respond",
      "type": "n8n-nodes-base.respondToWebhook",
      "parameters": { "respondWith": "json" }
    }
  ],
  "connections": {}
}
```

---

## Running n8n locally

Use the snippet in `infra/n8n/docker-compose.snippet.yml`. Merge it into the
root `docker-compose.yml` when ready (tracked in a separate commit):

```bash
docker compose -f docker-compose.yml -f infra/n8n/docker-compose.snippet.yml up n8n
```

Then open `http://localhost:5678` and import the workflow JSON.

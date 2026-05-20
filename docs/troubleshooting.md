# Troubleshooting

Common issues encountered when running LeetRank locally.

---

### 1. `prisma generate` not run before typecheck

**Symptom:** Many TS7006 errors saying "Parameter 'x' implicitly has an 'any' type"

**Cause:** `@prisma/client` exports collapse to `{}` when client isn't generated.

**Fix:** Run `pnpm prisma generate` before `pnpm typecheck` or `pnpm build`.

---

### 2. pnpm overrides not applied

**Symptom:** Pinned versions don't resolve; `pnpm why <pkg>` shows old transitive.

**Cause:** pnpm 9 doesn't read workspace-level overrides in `pnpm-workspace.yaml`.

**Fix:** Use pnpm 10+. Check with `pnpm --version`. If stuck on 9, move overrides into root `package.json` under `pnpm.overrides`.

---

### 3. Port 3000/5432/6379 conflict

**Symptom:** "Bind for 0.0.0.0:5432 failed: port is already allocated"

**Fix:** Use `docker compose -f docker-compose.yml -f docker-compose.local.yml up -d` to remap to 13000/15432/16379.

---

### 4. Judge container unhealthy on Windows

**Symptom:** `docker ps` shows judge as unhealthy with "wget not found".

**Cause:** Ubuntu base doesn't include wget by default; healthcheck uses curl.

**Fix:** Already fixed in compose (uses curl). Rebuild if seeing old healthcheck: `docker compose build judge`.

---

### 5. Submission stuck on "Run your code to see results here"

**Symptom:** Click Submit but verdict never appears.

**Cause:** UI requires polling — make sure web is rebuilt with the latest polling code.

**Fix:** `docker compose build web && docker compose up -d --no-deps web`

---

### 6. n8n chatbot returns 503

**Symptom:** Chatbot says "temporarily unavailable".

**Cause:** `N8N_CHATBOT_WEBHOOK_URL` is set but n8n container isn't running.

**Fix:** Either start n8n (`docker compose --profile workflows up -d n8n`), or unset the env var to use the local fallback replies.

---

### 7. Login works in API but cookie not sent in browser

**Symptom:** API curl succeeds but browser shows 401 after login.

**Cause:** Cookie has `Secure` flag; browser drops it on `http://`.

**Fix:** Use `http://localhost:13000` (allowed by browser) or set `NODE_ENV=development`.

---

### 8. JWT_SECRET error on startup

**Symptom:** "JWT_SECRET must be set" error in compose logs.

**Fix:** `cp .env.example .env` and edit `JWT_SECRET` to a 32+ char value.

---

### 9. Database denied access on `leetrank.public`

**Symptom:** Prisma migrations fail with P1010.

**Cause:** Connecting to wrong port (5432 vs 15432 in local compose).

**Fix:** Use port 15432 with `docker-compose.local.yml`, or 5432 inside docker network.

---

### 10. Tests fail with "Cannot find name 'afterEach'"

**Symptom:** TypeScript error in test files referencing vitest globals.

**Fix:** Import explicitly: `import { afterEach } from 'vitest';` — or ensure `vitest.config.ts` has `globals: true` and `tsconfig.json` includes `vitest/globals` in types.

---

## See also

- [Onboarding](./onboarding.md)
- [Runbook index](./runbooks/INDEX.md)
- [Architecture](./architecture/services.md)

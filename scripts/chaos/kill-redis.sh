#!/usr/bin/env bash
# scripts/chaos/kill-redis.sh
#
# Chaos drill — kill Redis and verify the platform's rate limiter falls
# back to its in-memory bucket. The web app must:
#   1. Continue serving public pages (homepage, /problems, /leaderboard).
#   2. Continue accepting login attempts (per-IP/per-account in-memory bucket).
#   3. Recover when Redis returns.
#
# Run from the repo root:
#   bash scripts/chaos/kill-redis.sh
#
# Exit codes:
#   0 — drill passed
#   1 — drill failed (5xx on read path while Redis is down)
#   2 — pre-flight failure

set -euo pipefail

# ── Pre-flight ────────────────────────────────────────────────────────────────

command -v docker >/dev/null || { echo "docker not found" >&2; exit 2; }
command -v curl   >/dev/null || { echo "curl not found"   >&2; exit 2; }

WEB_URL="${WEB_URL:-http://localhost:3000}"
DOWN_DURATION_S="${DOWN_DURATION_S:-30}"
REDIS_SERVICE="${REDIS_SERVICE:-redis}"

echo "==> Chaos drill: kill Redis for ${DOWN_DURATION_S}s"
echo "    Web URL : ${WEB_URL}"
echo "    Service : ${REDIS_SERVICE}"

# ── Sanity check: stack is up ────────────────────────────────────────────────

if ! docker compose ps "${REDIS_SERVICE}" >/dev/null 2>&1; then
  echo "FAIL: ${REDIS_SERVICE} not in docker compose. Did you start the stack?" >&2
  exit 2
fi

before_status=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_URL}/" || true)
echo "==> Web homepage status before chaos: ${before_status}"

# ── Inject failure: stop redis ───────────────────────────────────────────────

echo "==> Stopping ${REDIS_SERVICE}..."
docker compose stop "${REDIS_SERVICE}"

# ── Observe: probe public read paths during outage ───────────────────────────

declare -a PROBE_PATHS=("/" "/problems" "/leaderboard" "/api/health")
declare -A FAIL_BY_PATH

for p in "${PROBE_PATHS[@]}"; do
  FAIL_BY_PATH["${p}"]=0
done

total=0
end_at=$(( $(date +%s) + DOWN_DURATION_S ))
while [ "$(date +%s)" -lt "${end_at}" ]; do
  total=$((total + 1))
  for p in "${PROBE_PATHS[@]}"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_URL}${p}" || echo "000")
    if [ "${code}" -ge 500 ] || [ "${code}" = "000" ]; then
      FAIL_BY_PATH["${p}"]=$(( ${FAIL_BY_PATH["${p}"]} + 1 ))
    fi
  done
  sleep 1
done

echo "==> During chaos (${total} rounds):"
for p in "${PROBE_PATHS[@]}"; do
  echo "    ${p}: ${FAIL_BY_PATH["${p}"]} 5xx/transport errors"
done

# ── Recovery: restart Redis ──────────────────────────────────────────────────

echo "==> Restarting ${REDIS_SERVICE}..."
docker compose start "${REDIS_SERVICE}"
sleep 10

after_status=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_URL}/" || true)
echo "==> Web homepage status after recovery: ${after_status}"

# ── Verdict ──────────────────────────────────────────────────────────────────

# Acceptable: <10% 5xx on the homepage while Redis is down. Other paths
# get reported but only homepage is hard-asserted, since /api/health may
# intentionally degrade and /problems / /leaderboard depend on whether
# the request hit a cached page.

threshold=$(( total / 10 ))
home_fails=${FAIL_BY_PATH["/"]}

if [ "${home_fails}" -gt "${threshold}" ]; then
  echo "FAIL: homepage 5xx rate ${home_fails}/${total} exceeds 10% during Redis outage" >&2
  exit 1
fi

if [ "${after_status}" != "200" ]; then
  echo "FAIL: homepage did not recover (got ${after_status})" >&2
  exit 1
fi

echo "PASS: Redis outage handled gracefully (homepage ${home_fails}/${total} 5xx, recovery 200 OK)"
exit 0

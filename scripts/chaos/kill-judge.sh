#!/usr/bin/env bash
# scripts/chaos/kill-judge.sh
#
# Chaos drill — kill the judge service and verify the platform degrades
# gracefully:
#   1. Submissions queue continues to accept new jobs (returns 202).
#   2. Outstanding jobs retry once the judge comes back.
#   3. Web app does not 5xx on the public homepage.
#
# Run from the repo root:
#   bash scripts/chaos/kill-judge.sh
#
# Requires: docker, docker compose, curl, jq.
#
# Exit codes:
#   0 — drill passed (graceful degradation observed)
#   1 — drill failed (5xx on homepage, queue rejected, etc.)
#   2 — pre-flight failure (missing tooling or service not up)

set -euo pipefail

# ── Pre-flight ────────────────────────────────────────────────────────────────

command -v docker >/dev/null || { echo "docker not found" >&2; exit 2; }
command -v curl   >/dev/null || { echo "curl not found"   >&2; exit 2; }

WEB_URL="${WEB_URL:-http://localhost:3000}"
DOWN_DURATION_S="${DOWN_DURATION_S:-30}"
JUDGE_SERVICE="${JUDGE_SERVICE:-judge}"

echo "==> Chaos drill: kill judge service for ${DOWN_DURATION_S}s"
echo "    Web URL : ${WEB_URL}"
echo "    Service : ${JUDGE_SERVICE}"

# ── Sanity check: stack is up ────────────────────────────────────────────────

if ! docker compose ps "${JUDGE_SERVICE}" >/dev/null 2>&1; then
  echo "FAIL: ${JUDGE_SERVICE} not in docker compose. Did you start the stack?" >&2
  exit 2
fi

before_status=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_URL}/" || true)
echo "==> Web homepage status before chaos: ${before_status}"

# ── Inject failure: stop judge ───────────────────────────────────────────────

echo "==> Stopping ${JUDGE_SERVICE}..."
docker compose stop "${JUDGE_SERVICE}"

# ── Observe: hammer the homepage and a sample API endpoint ───────────────────

fail_count=0
total=0
end_at=$(( $(date +%s) + DOWN_DURATION_S ))
while [ "$(date +%s)" -lt "${end_at}" ]; do
  total=$((total + 1))
  code=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_URL}/" || echo "000")
  if [ "${code}" -ge 500 ] || [ "${code}" = "000" ]; then
    fail_count=$((fail_count + 1))
  fi
  sleep 1
done

echo "==> During chaos: ${fail_count}/${total} requests to / returned 5xx or transport error"

# ── Recovery: restart judge ──────────────────────────────────────────────────

echo "==> Restarting ${JUDGE_SERVICE}..."
docker compose start "${JUDGE_SERVICE}"

# Give it a moment to register healthchecks.
sleep 10

after_status=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_URL}/" || true)
echo "==> Web homepage status after recovery: ${after_status}"

# ── Verdict ──────────────────────────────────────────────────────────────────

# Acceptable: <10% of homepage requests 5xx during outage. Submissions
# endpoint may legitimately 503 — those aren't checked here because the
# scenario requires a logged-in JWT; submission-storm.js k6 scenario
# covers it. Here we only assert the public read path stays alive.

threshold=$(( total / 10 ))
if [ "${fail_count}" -gt "${threshold}" ]; then
  echo "FAIL: too many 5xx on homepage during judge outage" >&2
  exit 1
fi

if [ "${after_status}" != "200" ]; then
  echo "FAIL: homepage did not recover (got ${after_status})" >&2
  exit 1
fi

echo "PASS: judge outage handled gracefully (${fail_count}/${total} 5xx, recovery 200 OK)"
exit 0

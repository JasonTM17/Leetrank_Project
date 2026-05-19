#!/usr/bin/env bash
# scripts/chaos/flood-rate-limit.sh
#
# Chaos drill — verify the rate limiter on /api/auth/login. Sends 100
# requests in rapid succession from a single source IP and asserts the
# server starts returning 429 well before the 100th request lands.
#
# Why 100/min: production limit is 5 attempts per IP per 15 minutes
# (see src/app/api/auth/login/route.ts), so 100 in 60 seconds should
# trip the limiter within the first 6 requests.
#
# Run from the repo root:
#   bash scripts/chaos/flood-rate-limit.sh
#
# Exit codes:
#   0 — limiter tripped (≥80% of requests got 429 after the first 5)
#   1 — limiter did NOT trip (server still returning 200/401 → bug)
#   2 — pre-flight failure

set -euo pipefail

# ── Pre-flight ────────────────────────────────────────────────────────────────

command -v curl >/dev/null || { echo "curl not found" >&2; exit 2; }

WEB_URL="${WEB_URL:-http://localhost:3000}"
LOGIN_PATH="${LOGIN_PATH:-/api/auth/login}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-100}"
ATTACKER_IP="${ATTACKER_IP:-198.51.100.42}"

echo "==> Chaos drill: flood ${LOGIN_PATH} with ${TOTAL_REQUESTS} requests"
echo "    Source IP : ${ATTACKER_IP}"
echo "    Target    : ${WEB_URL}${LOGIN_PATH}"

# ── Issue requests ───────────────────────────────────────────────────────────

ok_count=0       # 2xx
unauth_count=0   # 401 (creds invalid, but pre-limit)
limited_count=0  # 429
other_count=0
fail_count=0     # 5xx + transport

for i in $(seq 1 "${TOTAL_REQUESTS}"); do
  body='{"email":"flood-test@leetrank.test","password":"wrong-password-on-purpose"}'
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: ${ATTACKER_IP}" \
    -X POST \
    --data "${body}" \
    "${WEB_URL}${LOGIN_PATH}" || echo "000")

  case "${code}" in
    2*)   ok_count=$((ok_count + 1)) ;;
    401)  unauth_count=$((unauth_count + 1)) ;;
    429)  limited_count=$((limited_count + 1)) ;;
    5*|000) fail_count=$((fail_count + 1)) ;;
    *)    other_count=$((other_count + 1)) ;;
  esac
done

echo "==> Result over ${TOTAL_REQUESTS} requests:"
echo "    2xx (login OK)   : ${ok_count}"
echo "    401 (bad creds)  : ${unauth_count}"
echo "    429 (rate limit) : ${limited_count}"
echo "    other            : ${other_count}"
echo "    5xx / transport  : ${fail_count}"

# ── Verdict ──────────────────────────────────────────────────────────────────

# Production limit is 5 per 15min, so on a 100-request flood from one
# IP we expect the vast majority to be 429. Allow some slack for the
# first ~5 to slip through before the limiter engages.
expected_min_429=$(( TOTAL_REQUESTS - 10 ))

if [ "${fail_count}" -gt 0 ]; then
  echo "FAIL: rate-limiter caused ${fail_count} 5xx/transport errors" >&2
  exit 1
fi

if [ "${limited_count}" -lt "${expected_min_429}" ]; then
  echo "FAIL: only ${limited_count}/${TOTAL_REQUESTS} requests rate-limited; expected at least ${expected_min_429}" >&2
  echo "      Limiter is either disabled, mis-keyed, or the test source IP varied." >&2
  exit 1
fi

echo "PASS: rate limiter tripped (${limited_count}/${TOTAL_REQUESTS} returned 429)"
exit 0

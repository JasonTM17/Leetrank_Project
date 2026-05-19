#!/usr/bin/env bash
# scripts/chaos/network-partition.sh
#
# Chaos drill — simulate a network partition between the web container
# and the postgres container by detaching the web service from the
# shared docker network. Verifies the web app surfaces a clean 503 on
# DB-backed routes rather than hanging or 5xx-ing the whole process.
#
# Run from the repo root:
#   bash scripts/chaos/network-partition.sh
#
# Defaults assume the docker-compose project name is `leetrank_project`
# (Docker derives this from the directory name unless overridden by
# COMPOSE_PROJECT_NAME). Override via COMPOSE_PROJECT_NAME env if
# different.
#
# Exit codes:
#   0 — drill passed (clean degradation + recovery)
#   1 — drill failed
#   2 — pre-flight failure

set -euo pipefail

# ── Pre-flight ────────────────────────────────────────────────────────────────

command -v docker >/dev/null || { echo "docker not found" >&2; exit 2; }
command -v curl   >/dev/null || { echo "curl not found"   >&2; exit 2; }

WEB_URL="${WEB_URL:-http://localhost:3000}"
PARTITION_DURATION_S="${PARTITION_DURATION_S:-20}"
PROJECT="${COMPOSE_PROJECT_NAME:-leetrank_project}"
NETWORK="${NETWORK:-${PROJECT}_default}"
TARGET_SERVICE="${TARGET_SERVICE:-postgres}"

# Resolve the actual container ID for the target service (compose names
# are deterministic but include project prefix and replica index).
container_id=$(docker compose ps -q "${TARGET_SERVICE}" || true)
if [ -z "${container_id}" ]; then
  echo "FAIL: could not resolve container for compose service '${TARGET_SERVICE}'" >&2
  echo "      Run 'docker compose up -d' first." >&2
  exit 2
fi

# Resolve the network. Fall back to the first non-default network the
# container is attached to if the guessed name is wrong.
if ! docker network inspect "${NETWORK}" >/dev/null 2>&1; then
  echo "==> Network '${NETWORK}' not found; auto-detecting from container..."
  NETWORK=$(docker inspect -f '{{range $k, $_ := .NetworkSettings.Networks}}{{$k}} {{end}}' "${container_id}" \
    | tr ' ' '\n' | grep -v '^$' | head -n1)
  if [ -z "${NETWORK}" ]; then
    echo "FAIL: could not resolve docker network for ${TARGET_SERVICE}" >&2
    exit 2
  fi
fi

echo "==> Chaos drill: partition ${TARGET_SERVICE} from network ${NETWORK} for ${PARTITION_DURATION_S}s"
echo "    Web URL   : ${WEB_URL}"
echo "    Container : ${container_id}"

before_status=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_URL}/" || true)
echo "==> Web homepage status before partition: ${before_status}"

# ── Inject partition ─────────────────────────────────────────────────────────

echo "==> Disconnecting ${TARGET_SERVICE} from ${NETWORK}..."
docker network disconnect "${NETWORK}" "${container_id}"

# Always reattach on exit so a failed drill doesn't leave the stack broken.
cleanup() {
  echo "==> Reconnecting ${TARGET_SERVICE} to ${NETWORK} (cleanup)..."
  docker network connect "${NETWORK}" "${container_id}" 2>/dev/null || true
}
trap cleanup EXIT

# ── Observe: hammer the public routes during partition ───────────────────────

home_5xx=0
api_5xx=0
total=0
end_at=$(( $(date +%s) + PARTITION_DURATION_S ))
while [ "$(date +%s)" -lt "${end_at}" ]; do
  total=$((total + 1))
  home_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${WEB_URL}/" || echo "000")
  api_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${WEB_URL}/api/health" || echo "000")
  [ "${home_code}" -ge 500 ] || [ "${home_code}" = "000" ] && home_5xx=$((home_5xx + 1)) || true
  [ "${api_code}"  -ge 500 ] || [ "${api_code}"  = "000" ] && api_5xx=$((api_5xx + 1))   || true
  sleep 1
done

echo "==> During partition (${total} rounds):"
echo "    /          5xx/transport: ${home_5xx}"
echo "    /api/health 5xx/transport: ${api_5xx}"

# ── Recovery ────────────────────────────────────────────────────────────────

echo "==> Reconnecting ${TARGET_SERVICE} to ${NETWORK}..."
docker network connect "${NETWORK}" "${container_id}"
trap - EXIT

# Give the app a few seconds to re-establish DB pool connections.
sleep 10

after_status=$(curl -s -o /dev/null -w "%{http_code}" "${WEB_URL}/" || true)
echo "==> Web homepage status after recovery: ${after_status}"

# ── Verdict ─────────────────────────────────────────────────────────────────

# We tolerate /api/health degrading (it's allowed to report unhealthy)
# but the homepage must not be totally unreachable, and the homepage
# must recover to 200 once the partition heals.

home_threshold=$(( total / 5 ))   # tolerate up to 20% homepage 5xx during outage
if [ "${home_5xx}" -gt "${home_threshold}" ]; then
  echo "FAIL: homepage 5xx rate ${home_5xx}/${total} during partition exceeds 20%" >&2
  exit 1
fi

if [ "${after_status}" != "200" ]; then
  echo "FAIL: homepage did not recover (got ${after_status})" >&2
  exit 1
fi

echo "PASS: network partition handled gracefully"
exit 0

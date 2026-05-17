#!/usr/bin/env bash
# php_runner.sh — PHP code executor for LeetRank judge service.
#
# Usage:
#   bash php_runner.sh <code_file_path>
#   (test-case input is read from stdin)
#
# Output (stdout):
#   JSON: {"output":"...","error":"...","timed_out":false}

set -uo pipefail

TIMEOUT_SECONDS="${RUNNER_TIMEOUT:-5}"

TMPOUT=$(mktemp)
TMPERR=$(mktemp)
trap 'rm -f "$TMPOUT" "$TMPERR"' EXIT

emit_json() {
  local timed_out="$1"
  RUNNER_OUTPUT="$(cat "$TMPOUT")" \
  RUNNER_ERROR="$(cat "$TMPERR")" \
  RUNNER_TIMED_OUT="$timed_out" \
  RUNNER_EXIT_CODE="${EXIT_CODE:-0}" \
  python3 -c "
import json, os
output = os.environ.get('RUNNER_OUTPUT', '')
error  = os.environ.get('RUNNER_ERROR', '')
timed_out  = os.environ.get('RUNNER_TIMED_OUT') == 'true'
exit_code  = int(os.environ.get('RUNNER_EXIT_CODE', '0'))
if exit_code != 0:
    lines = error.strip().splitlines()
    error = '\n'.join(lines[-10:]) if len(lines) > 10 else error.strip()
else:
    error = ''
print(json.dumps({'output': output, 'error': error, 'timed_out': timed_out}))
"
}

if [[ -z "${1:-}" ]]; then
  echo '{"output":"","error":"Usage: php_runner.sh <code_file>","timed_out":false}'
  exit 0
fi

CODE_FILE="$1"

if [[ ! -f "$CODE_FILE" ]]; then
  printf '{"output":"","error":"Code file not found: %s","timed_out":false}\n' "$CODE_FILE"
  exit 0
fi

STDIN_DATA=$(cat)

timeout "$TIMEOUT_SECONDS" php "$CODE_FILE" \
  <<<"$STDIN_DATA" >"$TMPOUT" 2>"$TMPERR"
EXIT_CODE=$?

if [[ $EXIT_CODE -eq 124 ]]; then
  emit_json "true"
  exit 0
fi

emit_json "false"

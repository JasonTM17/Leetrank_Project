#!/usr/bin/env bash
# bash_runner.sh — wraps a user bash script under a hard timeout and
# emits the runner JSON shape ({output, error, timed_out}).
#
# Args: $1 = path to user code file. Stdin = test-case input.
set -u
TIMEOUT_SECONDS="${RUNNER_TIMEOUT:-5}"

if [ -z "${1-}" ] || [ ! -f "$1" ]; then
  printf '{"output":"","error":"Code file not found: %s","timed_out":false}\n' "${1-}"
  exit 0
fi

# Read stdin into a temp file so we can hand it to the user script via redirection.
INPUT_FILE="$(mktemp)"
trap 'rm -f "$INPUT_FILE"' EXIT
cat - >"$INPUT_FILE"

OUT_FILE="$(mktemp)"
ERR_FILE="$(mktemp)"
trap 'rm -f "$INPUT_FILE" "$OUT_FILE" "$ERR_FILE"' EXIT

# Use coreutils `timeout` to bound runtime.
timeout --signal=KILL "$TIMEOUT_SECONDS" bash "$1" <"$INPUT_FILE" >"$OUT_FILE" 2>"$ERR_FILE"
STATUS=$?

OUT="$(cat "$OUT_FILE")"
ERR="$(cat "$ERR_FILE")"

# 124 = SIGTERM from timeout, 137 = SIGKILL from timeout.
if [ $STATUS -eq 124 ] || [ $STATUS -eq 137 ]; then
  printf '{"output":%s,"error":"","timed_out":true}\n' \
    "$(printf '%s' "$OUT" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
  exit 0
fi

if [ $STATUS -ne 0 ]; then
  printf '{"output":%s,"error":%s,"timed_out":false}\n' \
    "$(printf '%s' "$OUT" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')" \
    "$(printf '%s' "$ERR" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"
  exit 0
fi

printf '{"output":%s,"error":"","timed_out":false}\n' \
  "$(printf '%s' "$OUT" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')"

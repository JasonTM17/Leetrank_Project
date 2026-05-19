#!/usr/bin/env bash
# restore-postgres.sh — restore a leetrank pg dump (custom format) into $DATABASE_URL.
#
# Usage:
#   restore-postgres.sh <path/to/dump-or-encrypted-file>
#
# If the input ends in .age or .gpg, decryption is attempted via age or gpg
# respectively (BACKUP_PRIVKEY / BACKUP_KEY_FILE may be required).
#
# Inputs (env):
#   DATABASE_URL          required. Target Postgres connection string.
#   BACKUP_PRIVKEY        optional. Path to age identity file for decrypt.
#   BACKUP_KEY_FILE       optional. Path to gpg secret keyring (rare; usually default).
#   RESTORE_CLEAN         optional. If "1", pg_restore --clean drops objects first.
#
# Exit codes: 0 success; 1 misconfig; 2 decrypt failed; 3 pg_restore failed.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <dump|dump.age|dump.gpg>" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FATAL: DATABASE_URL is required" >&2
  exit 1
fi

INPUT="$1"
if [[ ! -f "${INPUT}" ]]; then
  echo "FATAL: input file not found: ${INPUT}" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

DUMP_PATH="${INPUT}"
case "${INPUT}" in
  *.age)
    if ! command -v age >/dev/null 2>&1; then
      echo "FATAL: input is .age but age is not installed" >&2
      exit 2
    fi
    DUMP_PATH="${WORK_DIR}/restore.dump"
    echo "[restore] decrypting via age"
    if [[ -n "${BACKUP_PRIVKEY:-}" ]]; then
      age -d -i "${BACKUP_PRIVKEY}" -o "${DUMP_PATH}" "${INPUT}"
    else
      age -d -o "${DUMP_PATH}" "${INPUT}"
    fi
    ;;
  *.gpg)
    if ! command -v gpg >/dev/null 2>&1; then
      echo "FATAL: input is .gpg but gpg is not installed" >&2
      exit 2
    fi
    DUMP_PATH="${WORK_DIR}/restore.dump"
    echo "[restore] decrypting via gpg"
    gpg --batch --yes -o "${DUMP_PATH}" -d "${INPUT}"
    ;;
esac

CLEAN_FLAG=""
if [[ "${RESTORE_CLEAN:-0}" == "1" ]]; then
  CLEAN_FLAG="--clean --if-exists"
fi

echo "[restore] running pg_restore ${CLEAN_FLAG}"
# shellcheck disable=SC2086
if ! pg_restore --no-owner --no-privileges ${CLEAN_FLAG} --dbname="${DATABASE_URL}" "${DUMP_PATH}"; then
  echo "FATAL: pg_restore failed" >&2
  exit 3
fi

echo "[restore] OK ${INPUT}"

#!/usr/bin/env bash
# backup-postgres.sh — dump leetrank pg, optional age/gpg encrypt, optional S3 upload.
#
# Inputs (env):
#   DATABASE_URL          required. Postgres connection string consumed by pg_dump.
#   BACKUP_DIR            optional. Local output dir. Default: /var/backups/leetrank.
#   BACKUP_PUBKEY         optional. age recipient (age1...) or gpg key id; enables encryption.
#   BACKUP_S3_BUCKET      optional. If set, uploads dump to s3://$BACKUP_S3_BUCKET/postgres/
#   BACKUP_RETAIN_DAYS    optional. Local retention in days. Default: 14.
#
# Exit codes: 0 success; 1 misconfig; 2 pg_dump failed; 3 encrypt failed; 4 upload failed.
#
# See docs/runbooks/disaster-recovery.md and ADR 0029 for context.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FATAL: DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/leetrank}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE="leetrank-${TIMESTAMP}"
DUMP_PATH="${BACKUP_DIR}/${BASE}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[backup] target=${DUMP_PATH}"
if ! pg_dump --format=custom --compress=9 --no-owner --no-privileges "${DATABASE_URL}" >"${DUMP_PATH}"; then
  echo "FATAL: pg_dump failed" >&2
  rm -f "${DUMP_PATH}"
  exit 2
fi

OUTPUT_PATH="${DUMP_PATH}"

if [[ -n "${BACKUP_PUBKEY:-}" ]]; then
  if command -v age >/dev/null 2>&1; then
    OUTPUT_PATH="${DUMP_PATH}.age"
    echo "[backup] encrypting via age -> ${OUTPUT_PATH}"
    if ! age -r "${BACKUP_PUBKEY}" -o "${OUTPUT_PATH}" "${DUMP_PATH}"; then
      echo "FATAL: age encrypt failed" >&2
      exit 3
    fi
    rm -f "${DUMP_PATH}"
  elif command -v gpg >/dev/null 2>&1; then
    OUTPUT_PATH="${DUMP_PATH}.gpg"
    echo "[backup] encrypting via gpg -> ${OUTPUT_PATH}"
    if ! gpg --batch --yes --trust-model always -r "${BACKUP_PUBKEY}" -o "${OUTPUT_PATH}" -e "${DUMP_PATH}"; then
      echo "FATAL: gpg encrypt failed" >&2
      exit 3
    fi
    rm -f "${DUMP_PATH}"
  else
    echo "WARN: BACKUP_PUBKEY set but neither age nor gpg installed; leaving plaintext" >&2
  fi
fi

if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "FATAL: BACKUP_S3_BUCKET set but aws CLI missing" >&2
    exit 4
  fi
  S3_KEY="postgres/$(basename "${OUTPUT_PATH}")"
  echo "[backup] uploading to s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
  if ! aws s3 cp "${OUTPUT_PATH}" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}" --only-show-errors; then
    echo "FATAL: s3 upload failed" >&2
    exit 4
  fi
fi

# Local retention sweep — keep last N days only.
find "${BACKUP_DIR}" -maxdepth 1 -type f \
  \( -name 'leetrank-*.dump' -o -name 'leetrank-*.dump.age' -o -name 'leetrank-*.dump.gpg' \) \
  -mtime "+${BACKUP_RETAIN_DAYS}" -print -delete || true

echo "[backup] OK ${OUTPUT_PATH}"

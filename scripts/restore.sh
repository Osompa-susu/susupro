#!/usr/bin/env bash
# Used for BOTH real recovery and the monthly verification drill.
# Point RESTORE_DATABASE_URL at a scratch database for drills, never
# at production for a drill.
set -euo pipefail
: "${BACKUP_FILE:?Set BACKUP_FILE to the .dump.enc file to restore}"
: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL}"

DECRYPTED_FILE="/tmp/$(basename "${BACKUP_FILE}" .enc)"
echo "[restore] decrypting ${BACKUP_FILE}"
openssl enc -d -aes-256-cbc -pbkdf2 -in "${BACKUP_FILE}" -out "${DECRYPTED_FILE}" -pass "pass:${BACKUP_ENCRYPTION_KEY}"
echo "[restore] restoring into ${RESTORE_DATABASE_URL}"
pg_restore --clean --if-exists --no-owner --dbname="${RESTORE_DATABASE_URL}" "${DECRYPTED_FILE}"
rm -f "${DECRYPTED_FILE}"
echo "[restore] done — run verify.sql next against the same RESTORE_DATABASE_URL"

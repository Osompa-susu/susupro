#!/usr/bin/env bash
# Nightly backup script. Run via cron/systemd timer, not manually.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
: "${BACKUP_DIR:?Set BACKUP_DIR to off-server, encrypted-at-rest storage}"
: "${BACKUP_ENCRYPTION_KEY:?Set BACKUP_ENCRYPTION_KEY}"

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DUMP_FILE="${BACKUP_DIR}/susupro_${TIMESTAMP}.dump"
ENCRYPTED_FILE="${DUMP_FILE}.enc"

echo "[backup] starting dump at ${TIMESTAMP}"
pg_dump --format=custom --file="${DUMP_FILE}" "${DATABASE_URL}"
openssl enc -aes-256-cbc -pbkdf2 -salt -in "${DUMP_FILE}" -out "${ENCRYPTED_FILE}" -pass "pass:${BACKUP_ENCRYPTION_KEY}"
rm -f "${DUMP_FILE}"
echo "[backup] encrypted dump written to ${ENCRYPTED_FILE}"

# Retention: 30 daily + anything on the 1st of the month kept longer.
find "${BACKUP_DIR}" -name 'susupro_*.dump.enc' -mtime +30 ! -name '*01T*' -delete
echo "[backup] done"

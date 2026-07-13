#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${SSH_HOST:-vps-sh}"
DB_NAME="${DB_NAME:-tms}"
DB_PORT="${DB_PORT:-5433}"
BACKUP_DIR="${BACKUP_DIR:-outputs/backups}"
STAMP="$(date +%Y%m%d%H%M%S)"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DIR="$ROOT_DIR/$BACKUP_DIR"
LOCAL_FILE="$LOCAL_DIR/${DB_NAME}-${STAMP}.dump"
REMOTE_FILE="/tmp/${DB_NAME}-${STAMP}.dump"

mkdir -p "$LOCAL_DIR"

echo "Creating PostgreSQL backup from $SSH_HOST:$DB_NAME on port $DB_PORT"
ssh "$SSH_HOST" "set -eu; sudo -u postgres pg_dump -p '$DB_PORT' -Fc '$DB_NAME' > '$REMOTE_FILE'; ls -lh '$REMOTE_FILE'"
scp "$SSH_HOST:$REMOTE_FILE" "$LOCAL_FILE"
ssh "$SSH_HOST" "rm -f '$REMOTE_FILE'"

ls -lh "$LOCAL_FILE"
echo "Backup saved to $LOCAL_FILE"

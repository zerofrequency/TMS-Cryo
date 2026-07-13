#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${SSH_HOST:-vps-sh}"
REMOTE_BASE="${REMOTE_BASE:-/var/www/tms}"
REMOTE_RELEASES="$REMOTE_BASE/releases"
REMOTE_CURRENT="$REMOTE_BASE/current"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d%H%M%S)}"
REMOTE_RELEASE="$REMOTE_RELEASES/$RELEASE_ID"
DRY_RUN="${DRY_RUN:-0}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RSYNC_ARGS=(
  -az
  --delete
  --include=/index.html
  --include=/login.html
  --include=/appts.html
  --include=/data/
  --include=/data/***
  --include=/pages/
  --include=/pages/***
  --include=/scripts/
  --include=/scripts/*.js
  --include=/styles/
  --include=/styles/***
  --exclude=/supabase-config.js
  --exclude=/map-config.js
  --exclude=/docs/tasks/
  --exclude=/outputs/
  --exclude=/.git/
  --exclude=*
)

if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
fi

if [[ "$DRY_RUN" == "1" ]]; then
  echo "Dry-running TMS deploy against $SSH_HOST:$REMOTE_CURRENT"
  rsync "${RSYNC_ARGS[@]}" "$ROOT_DIR"/ "$SSH_HOST:$REMOTE_CURRENT"/
  echo "Dry run complete. No release symlink was changed."
  exit 0
fi

echo "Deploying TMS to $SSH_HOST:$REMOTE_RELEASE"
ssh "$SSH_HOST" "set -eu; mkdir -p '$REMOTE_RELEASE' '$REMOTE_RELEASES'"
rsync "${RSYNC_ARGS[@]}" "$ROOT_DIR"/ "$SSH_HOST:$REMOTE_RELEASE"/

ssh "$SSH_HOST" "set -eu
if [ -f '$REMOTE_CURRENT/supabase-config.js' ]; then
  cp '$REMOTE_CURRENT/supabase-config.js' '$REMOTE_RELEASE/supabase-config.js'
fi
if [ -f '$REMOTE_CURRENT/map-config.js' ]; then
  cp '$REMOTE_CURRENT/map-config.js' '$REMOTE_RELEASE/map-config.js'
fi
ln -sfn '$REMOTE_RELEASE' '$REMOTE_CURRENT'
chown -R www-data:www-data '$REMOTE_BASE'
find '$REMOTE_RELEASE' -type d -exec chmod 755 {} +
find '$REMOTE_RELEASE' -type f -exec chmod 644 {} +
nginx -t
systemctl reload nginx
readlink -f '$REMOTE_CURRENT'
"

echo "Deployment complete: $REMOTE_RELEASE"

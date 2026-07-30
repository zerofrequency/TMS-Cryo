#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${SSH_HOST:-vps-ca}"
PUBLIC_URL="${PUBLIC_URL:-http://tms.zefanlong.space}"
REMOTE_BASE="${REMOTE_BASE:-/var/www/tms}"
REMOTE_RELEASES="$REMOTE_BASE/releases"
REMOTE_CURRENT="$REMOTE_BASE/current"
RELEASE_ID="${RELEASE_ID:-$(date +%Y%m%d%H%M%S)}"
REMOTE_RELEASE="$REMOTE_RELEASES/$RELEASE_ID"
REMOTE_STAGING="/tmp/tms-deploy-$RELEASE_ID"
REMOTE_BACKUP="/var/backups/tms/$RELEASE_ID"
DRY_RUN="${DRY_RUN:-0}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RSYNC_ARGS=(
  -az
  --delete
  --include=/index.html
  --include=/login.html
  --include=/appts.html
  --exclude=/data/carrier-appointments.json
  --exclude=*.csv
  --exclude=*.xlsx
  --exclude=*.xls
  --include=/data/
  --include=/data/***
  --include=/assets/
  --include=/assets/***
  --include=/pages/
  --include=/pages/***
  --include=/scripts/
  --include=/scripts/*.js
  --include=/styles/
  --include=/styles/***
  --exclude=/tms-config.js
  --exclude=/map-config.js
  --exclude=/docs/tasks/
  --exclude=/outputs/
  --exclude=/.git/
  --exclude=*
)

if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
  echo "Dry-running TMS static release against $SSH_HOST:$REMOTE_CURRENT"
  rsync "${RSYNC_ARGS[@]}" "$ROOT_DIR"/ "$SSH_HOST:$REMOTE_CURRENT"/
  echo "Service assets: server/tms-documents-server.py, deploy/tms-documents.service, deploy/nginx-tms.conf.template"
  echo "Dry run complete. No service, nginx, or release symlink was changed."
  exit 0
fi

rollback() {
  echo "Deployment verification failed. Restoring the previous TMS release." >&2
  ssh "$SSH_HOST" bash -s -- "$REMOTE_CURRENT" "$REMOTE_BACKUP" <<'REMOTE_ROLLBACK'
set -euo pipefail
current_link="$1"
backup_dir="$2"
if [[ -s "$backup_dir/previous-release" ]]; then
  ln -sfn "$(cat "$backup_dir/previous-release")" "$current_link"
fi
if [[ -f "$backup_dir/nginx-tms.conf" ]]; then
  install -o root -g root -m 0644 "$backup_dir/nginx-tms.conf" /etc/nginx/sites-available/tms
  ln -sfn /etc/nginx/sites-available/tms /etc/nginx/sites-enabled/tms
fi
if [[ -f "$backup_dir/tms-documents.service" ]]; then
  install -o root -g root -m 0644 "$backup_dir/tms-documents.service" /etc/systemd/system/tms-documents.service
  systemctl daemon-reload
  systemctl restart tms-documents.service || true
else
  systemctl disable --now tms-documents.service >/dev/null 2>&1 || true
fi
nginx -t
systemctl reload nginx
REMOTE_ROLLBACK
}

echo "Deploying TMS to $SSH_HOST:$REMOTE_RELEASE"
ssh "$SSH_HOST" "set -eu; mkdir -p '$REMOTE_RELEASE' '$REMOTE_RELEASES' '$REMOTE_STAGING' '$REMOTE_BACKUP'"
rsync "${RSYNC_ARGS[@]}" "$ROOT_DIR"/ "$SSH_HOST:$REMOTE_RELEASE"/
(
  cd "$ROOT_DIR"
  rsync -az --relative \
    server/tms-documents-server.py \
    deploy/tms-documents.service \
    deploy/nginx-tms.conf.template \
    scripts/install-vps-services.sh \
    "$SSH_HOST:$REMOTE_STAGING"/
)

ssh "$SSH_HOST" bash -s -- "$REMOTE_CURRENT" "$REMOTE_RELEASE" "$REMOTE_BASE" "$REMOTE_BACKUP" <<'REMOTE_PREPARE'
set -euo pipefail
current_link="$1"
release_dir="$2"
base_dir="$3"
backup_dir="$4"

if [[ -e "$current_link" ]]; then
  readlink -f "$current_link" > "$backup_dir/previous-release"
fi
if [[ -f /etc/nginx/sites-available/tms ]]; then
  cp /etc/nginx/sites-available/tms "$backup_dir/nginx-tms.conf"
fi
if [[ -f /etc/systemd/system/tms-documents.service ]]; then
  cp /etc/systemd/system/tms-documents.service "$backup_dir/tms-documents.service"
fi

if [[ -f "$current_link/tms-config.js" ]]; then
  cp "$current_link/tms-config.js" "$release_dir/tms-config.js"
else
  printf '%s\n' \
    'window.TMS_CONFIG = {' \
    '  apiBaseUrl: "",' \
    '  apiToken: "",' \
    '  documentBaseUrl: "/documents",' \
    '};' > "$release_dir/tms-config.js"
fi
if [[ -f "$current_link/map-config.js" ]]; then
  cp "$current_link/map-config.js" "$release_dir/map-config.js"
fi

if [[ -d "$current_link" && ! -L "$current_link" ]]; then
  rm -rf "$current_link"
fi

chown -R www-data:www-data "$base_dir"
find "$release_dir" -type d -exec chmod 755 {} +
find "$release_dir" -type f -exec chmod 644 {} +
REMOTE_PREPARE

ssh "$SSH_HOST" "bash '$REMOTE_STAGING/scripts/install-vps-services.sh' '$REMOTE_STAGING'"
ssh "$SSH_HOST" "set -eu; ln -sfn '$REMOTE_RELEASE' '$REMOTE_CURRENT'; readlink -f '$REMOTE_CURRENT'"

if ! SSH_HOST="$SSH_HOST" PUBLIC_URL="$PUBLIC_URL" "$ROOT_DIR/scripts/check-vps.sh"; then
  rollback
  exit 1
fi

ssh "$SSH_HOST" "rm -rf '$REMOTE_STAGING'"
echo "Deployment complete: $REMOTE_RELEASE"

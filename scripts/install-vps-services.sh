#!/usr/bin/env bash
set -euo pipefail

SOURCE_ROOT="${1:-}"
SESSION_FILE="/etc/tms/tms-login-session-token"
NGINX_SITE="/etc/nginx/sites-available/tms"
NGINX_ENABLED="/etc/nginx/sites-enabled/tms"
SERVICE_FILE="/etc/systemd/system/tms-documents.service"
SERVER_DIR="/opt/tms/server"
DOCUMENT_ROOT="/var/lib/tms/documents"

if [[ -z "$SOURCE_ROOT" || ! -d "$SOURCE_ROOT" ]]; then
  echo "Usage: install-vps-services.sh <staged-repository-root>" >&2
  exit 2
fi
if [[ ! -s "$SESSION_FILE" ]]; then
  echo "Missing TMS session token file." >&2
  exit 1
fi

SESSION_TOKEN="$(tr -d '\r\n' < "$SESSION_FILE")"
if [[ -z "$SESSION_TOKEN" ]]; then
  echo "TMS session token is empty." >&2
  exit 1
fi

install -d -o root -g root -m 0755 "$SERVER_DIR"
install -d -o www-data -g www-data -m 0750 "$DOCUMENT_ROOT"
install -o root -g root -m 0644 "$SOURCE_ROOT/server/tms-documents-server.py" "$SERVER_DIR/tms-documents-server.py"
install -o root -g root -m 0644 "$SOURCE_ROOT/deploy/tms-documents.service" "$SERVICE_FILE"

TOKEN_ESCAPED="$(printf '%s' "$SESSION_TOKEN" | sed 's/[&|\\]/\\&/g')"
RENDERED_SITE="$(mktemp)"
SITE_BACKUP="$(mktemp)"
cleanup() {
  rm -f "$RENDERED_SITE" "$SITE_BACKUP"
}
trap cleanup EXIT

sed "s|__TMS_SESSION_TOKEN__|$TOKEN_ESCAPED|g" "$SOURCE_ROOT/deploy/nginx-tms.conf.template" > "$RENDERED_SITE"
if [[ -f "$NGINX_SITE" ]]; then
  cp "$NGINX_SITE" "$SITE_BACKUP"
fi
install -o root -g root -m 0644 "$RENDERED_SITE" "$NGINX_SITE"
ln -sfn "$NGINX_SITE" "$NGINX_ENABLED"

if ! nginx -t; then
  if [[ -s "$SITE_BACKUP" ]]; then
    install -o root -g root -m 0644 "$SITE_BACKUP" "$NGINX_SITE"
  else
    rm -f "$NGINX_SITE" "$NGINX_ENABLED"
  fi
  nginx -t
  echo "Restored previous nginx configuration after validation failure." >&2
  exit 1
fi

systemctl daemon-reload
systemctl enable tms-documents.service >/dev/null
systemctl restart tms-documents.service
systemctl is-active --quiet tms-documents.service
systemctl reload nginx

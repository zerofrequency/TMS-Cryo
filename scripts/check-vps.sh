#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${SSH_HOST:-vps-sh}"
PUBLIC_URL="${PUBLIC_URL:-http://tms.zefanlong.space}"
DB_NAME="${DB_NAME:-tms}"
DB_PORT="${DB_PORT:-5433}"

ssh "$SSH_HOST" bash -s -- "$PUBLIC_URL" "$DB_NAME" "$DB_PORT" <<'REMOTE_CHECK'
set -euo pipefail

PUBLIC_URL="$1"
DB_NAME="$2"
DB_PORT="$3"

echo '== services =='
systemctl is-active derper
systemctl is-active nginx
systemctl is-active tms-login
systemctl is-active tms-postgrest
systemctl is-active tms-documents
systemctl is-active postgresql@16-main

echo '== ports =='
ss -ltnup | grep -E "(:80|:443|:3478|:3000|:3100|:3101|:$DB_PORT)" || true
ss -ltnp | grep -q '127.0.0.1:3000' || { echo 'PostgREST must listen on 127.0.0.1:3000 only'; exit 1; }
ss -ltnp | grep -q '127.0.0.1:3101' || { echo 'Document service must listen on 127.0.0.1:3101'; exit 1; }
if ss -ltnp | grep -Eq '(0\.0\.0\.0|\[::\]|\*):3101'; then
  echo 'Document service must not listen publicly on port 3101'
  exit 1
fi
ss -ltnp | grep -q ':443' || { echo 'DERP TCP 443 listener is missing'; exit 1; }
ss -lunp | grep -q ':3478' || { echo 'DERP UDP 3478 listener is missing'; exit 1; }

echo '== database =='
pg_lsclusters | sed -n '1,5p'
sudo -u postgres psql -p "$DB_PORT" -d "$DB_NAME" -Atc "select 'appointments=' || count(*) from appointments;"
sudo -u postgres psql -p "$DB_PORT" -d "$DB_NAME" -Atc "select 'fba_fcs=' || count(*) from fba_fcs;"

PASS="$(cat /etc/tms/tms-basic-auth-password)"
JAR="$(mktemp)"
PDF="$(mktemp)"
META="$(mktemp)"
DOWNLOADED="$(mktemp)"
FILE_URL=""
cleanup() {
  if [[ -n "$FILE_URL" ]]; then
    curl --noproxy '*' -b "$JAR" --output /dev/null --silent --max-time 10 -X DELETE "$PUBLIC_URL$FILE_URL" || true
  fi
  rm -f "$JAR" "$PDF" "$META" "$DOWNLOADED"
}
trap cleanup EXIT
printf '%%PDF-1.7\nTMS health check\n' > "$PDF"

echo '== http flow =='
printf 'login_page='
curl --noproxy '*' --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}\n' "$PUBLIC_URL/login.html"
printf 'home_without_cookie='
curl --noproxy '*' --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code} %{redirect_url}\n' "$PUBLIC_URL/"
printf 'document_without_cookie='
anonymous_document_status="$(curl --noproxy '*' --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}' "$PUBLIC_URL/documents/files/missing.pdf")"
echo "$anonymous_document_status"
[[ "$anonymous_document_status" == "302" ]]
printf 'login_post='
curl --noproxy '*' -c "$JAR" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code} %{redirect_url}\n' -X POST -d "username=tms&password=$PASS" "$PUBLIC_URL/auth/login"
printf 'home_with_cookie='
curl --noproxy '*' -b "$JAR" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}\n' "$PUBLIC_URL/"
printf 'config_with_cookie='
config_status="$(curl --noproxy '*' -b "$JAR" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}' "$PUBLIC_URL/tms-config.js")"
echo "$config_status"
[[ "$config_status" == "200" ]]
printf 'api_with_cookie='
api_status="$(curl --noproxy '*' -b "$JAR" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}' "$PUBLIC_URL/rest/v1/appointments?select=isa&limit=1")"
echo "$api_status"
[[ "$api_status" == "200" ]]

echo '== document flow =='
upload_status="$(curl --noproxy '*' -b "$JAR" --output "$META" --silent --show-error --max-time 10 --write-out '%{http_code}' \
  -X PUT \
  -H 'Content-Type: application/pdf' \
  -H 'X-TMS-Entity-Type: trip_plan' \
  -H 'X-TMS-Entity-Id: 11111111-1111-4111-8111-111111111111' \
  -H 'X-TMS-Document-Type: pod' \
  -H 'X-TMS-File-Name: health-check.pdf' \
  --data-binary "@$PDF" \
  "$PUBLIC_URL/documents/files")"
echo "upload=$upload_status"
[[ "$upload_status" == "201" ]]
FILE_URL="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["fileUrl"])' "$META")"
[[ "$FILE_URL" == /documents/files/* ]]

download_status="$(curl --noproxy '*' -b "$JAR" --output "$DOWNLOADED" --silent --show-error --max-time 10 --write-out '%{http_code}' "$PUBLIC_URL$FILE_URL")"
echo "download=$download_status"
[[ "$download_status" == "200" ]]
cmp "$PDF" "$DOWNLOADED"

delete_status="$(curl --noproxy '*' -b "$JAR" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}' -X DELETE "$PUBLIC_URL$FILE_URL")"
echo "delete=$delete_status"
[[ "$delete_status" == "204" ]]
missing_status="$(curl --noproxy '*' -b "$JAR" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}' "$PUBLIC_URL$FILE_URL")"
echo "after_delete=$missing_status"
[[ "$missing_status" == "404" ]]
FILE_URL=""
REMOTE_CHECK

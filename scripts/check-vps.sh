#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${SSH_HOST:-vps-sh}"
PUBLIC_URL="${PUBLIC_URL:-http://tms.zefanlong.space}"
DB_NAME="${DB_NAME:-tms}"
DB_PORT="${DB_PORT:-5433}"

ssh "$SSH_HOST" "set -eu
echo '== services =='
systemctl is-active derper
systemctl is-active nginx
systemctl is-active tms-login
systemctl is-active tms-postgrest
systemctl is-active postgresql@16-main

echo '== ports =='
ss -ltnup | grep -E '(:80|:443|:3478|:3000|:3100|:$DB_PORT)' || true
ss -ltnp | grep -q '127.0.0.1:3000' || { echo 'PostgREST must listen on 127.0.0.1:3000 only'; exit 1; }

echo '== database =='
pg_lsclusters | sed -n '1,5p'
sudo -u postgres psql -p '$DB_PORT' -d '$DB_NAME' -Atc \"select 'appointments=' || count(*) from appointments;\"
sudo -u postgres psql -p '$DB_PORT' -d '$DB_NAME' -Atc \"select 'fba_fcs=' || count(*) from fba_fcs;\"

echo '== http flow =='
PASS=\$(cat /etc/tms/tms-basic-auth-password)
JAR=\$(mktemp)
trap 'rm -f \"\$JAR\"' EXIT
printf 'login_page='
curl --noproxy '*' --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}\n' '$PUBLIC_URL/login.html'
printf 'home_without_cookie='
curl --noproxy '*' --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code} %{redirect_url}\n' '$PUBLIC_URL/'
printf 'login_post='
curl --noproxy '*' -c \"\$JAR\" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code} %{redirect_url}\n' -X POST -d \"username=tms&password=\$PASS\" '$PUBLIC_URL/auth/login'
printf 'home_with_cookie='
curl --noproxy '*' -b \"\$JAR\" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}\n' '$PUBLIC_URL/'
printf 'api_with_cookie='
curl --noproxy '*' -b \"\$JAR\" --output /dev/null --silent --show-error --max-time 10 --write-out '%{http_code}\n' '$PUBLIC_URL/rest/v1/appointments?select=isa&limit=1'
"

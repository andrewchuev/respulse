#!/bin/sh
# Daily Postgres dump with rotation, run from cron on the server.
set -eu

DIR=${BACKUP_DIR:-/opt/respulse/backups}
KEEP=${BACKUP_KEEP:-14}
PING_URL=${BACKUP_PING_URL:-https://respulse.online/api/heartbeat/37e2216caedb454ea5286aa1ee8d1044}

umask 077
mkdir -p "$DIR"

TS=$(date +%Y%m%d-%H%M%S)
TMP="$DIR/.db-$TS.dump.tmp"
trap 'rm -f "$TMP"' EXIT

if [ -n "$PING_URL" ]; then
    curl -fsS -m 10 "$PING_URL/start" >/dev/null 2>&1 || true
fi

docker exec respulse-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TMP"

# A truncated or empty dump must never replace a good backup during rotation.
if [ ! -s "$TMP" ]; then
    echo "backup failed: empty dump" >&2
    if [ -n "$PING_URL" ]; then
        curl -fsS -m 10 -d "backup failed: empty dump" "$PING_URL/fail" >/dev/null 2>&1 || true
    fi
    exit 1
fi
docker exec -i respulse-db pg_restore -l < "$TMP" > /dev/null

mv "$TMP" "$DIR/db-$TS.dump"
ls -1t "$DIR"/db-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm --
echo "$(date -Is) backup ok: db-$TS.dump"

if [ -n "$PING_URL" ]; then
    curl -fsS -m 10 --retry 3 "$PING_URL" >/dev/null 2>&1 || true
fi


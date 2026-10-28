#!/bin/sh
# Daily Postgres dump with rotation, run from cron on the server.
set -eu

DIR=${BACKUP_DIR:-/opt/respulse/backups}
KEEP=${BACKUP_KEEP:-14}

umask 077
mkdir -p "$DIR"

TS=$(date +%Y%m%d-%H%M%S)
TMP="$DIR/.db-$TS.dump.tmp"
trap 'rm -f "$TMP"' EXIT

docker exec respulse-db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TMP"

# A truncated or empty dump must never replace a good backup during rotation.
[ -s "$TMP" ] || { echo "backup failed: empty dump" >&2; exit 1; }
docker exec -i respulse-db pg_restore -l < "$TMP" > /dev/null

mv "$TMP" "$DIR/db-$TS.dump"
ls -1t "$DIR"/db-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm --
echo "$(date -Is) backup ok: db-$TS.dump"

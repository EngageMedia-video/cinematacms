#!/bin/bash
# Moves the local dev database from the PostgreSQL 14 volume to the 18 volume.
# Runs on bash 3.2 (macOS), so it uses no timeout, mapfile or associative arrays.

set -euo pipefail

COMPOSE_FILE="${CINEMATA_COMPOSE_FILE:-docker-compose.dev.yml}"
OLD_IMAGE="postgres:14-alpine"
DB_USER="mediacms"
DB_NAME="mediacms"
READY_ATTEMPTS=60
REPLACE_NEW_VOLUME=false
DUMP_FILE=""

usage() {
    cat <<'EOF'
Usage: scripts/migrate-dev-postgres-18.sh [--replace-new-volume] [--dump-file PATH]

Copies the dev database from the PostgreSQL 14 volume (postgres_data) into
the PostgreSQL 18 volume (postgres18_data). The 14 volume is left in place.

Options:
  --replace-new-volume  Delete the 18 volume first. Needed when it already exists,
                        for example after a fresh-start migrate.
  --dump-file PATH      Where to write the dump. Default: mediacms-pg14-<time>.dump
  -h, --help            Show this help text.
EOF
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

compose() {
    docker compose -f "$COMPOSE_FILE" "$@"
}

volume_exists() {
    docker volume inspect "$1" >/dev/null 2>&1
}

# Waits over TCP: the image's init-time server listens on the socket only, so
# this passes only once the final server accepts connections.
wait_until_ready() {
    local _
    for _ in $(seq "$READY_ATTEMPTS"); do
        if "$@" pg_isready -h localhost -U "$DB_USER" -d "$DB_NAME" -q; then
            return 0
        fi
        sleep 1
    done
    return 1
}

remove_export_container() {
    docker rm -f "$export_container" >/dev/null 2>&1 || true
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --replace-new-volume)
            REPLACE_NEW_VOLUME=true
            shift
            ;;
        --dump-file)
            [ "$#" -ge 2 ] || fail "--dump-file requires a path"
            DUMP_FILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage >&2
            fail "unknown option: $1"
            ;;
    esac
done

[ -f "$COMPOSE_FILE" ] || fail "$COMPOSE_FILE not found; run this from the repository root"
DUMP_FILE="${DUMP_FILE:-mediacms-pg14-$(date +%Y%m%d%H%M%S).dump}"
[ ! -e "$DUMP_FILE" ] || fail "$DUMP_FILE already exists"

project=$(compose config | sed -n 's/^name: //p')
[ -n "$project" ] || fail "could not read the Compose project name"
old_volume="${project}_postgres_data"
new_volume="${project}_postgres18_data"
# One name per project, so a second migration of the same project fails to
# start its exporter instead of running a second server on the same volume.
export_container="${project}-pg14-export"

if ! volume_exists "$old_volume"; then
    echo "No PostgreSQL 14 volume $old_volume found; nothing to migrate."
    exit 0
fi
if volume_exists "$new_volume" && [ "$REPLACE_NEW_VOLUME" != true ]; then
    fail "$new_volume already exists. Re-run with --replace-new-volume to delete it and restore into an empty database."
fi

echo "Stopping the dev services"
compose down

echo "Exporting $DB_NAME from $old_volume"
docker run -d --name "$export_container" -v "$old_volume":/var/lib/postgresql/data "$OLD_IMAGE" >/dev/null \
    || fail "could not start $export_container. If no other migration is running, remove it with: docker rm -f $export_container"
trap remove_export_container EXIT
wait_until_ready docker exec "$export_container" || fail "the PostgreSQL 14 server in $old_volume did not start; see: docker logs $export_container"
docker exec "$export_container" pg_dump -U "$DB_USER" -Fc "$DB_NAME" >"$DUMP_FILE" || fail "pg_dump failed; $old_volume is unchanged"
remove_export_container
trap - EXIT

if volume_exists "$new_volume"; then
    [ "$REPLACE_NEW_VOLUME" = true ] || \
        fail "$new_volume appeared during the export and was kept. The dump is in $DUMP_FILE. Re-run with --replace-new-volume to replace it."
    echo "Deleting $new_volume"
    docker volume rm "$new_volume" >/dev/null
fi

echo "Restoring into PostgreSQL 18"
compose up -d db
wait_until_ready compose exec -T db || fail "the PostgreSQL 18 server did not start; see: docker compose -f $COMPOSE_FILE logs db"
compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --exit-on-error --single-transaction <"$DUMP_FILE" \
    || fail "pg_restore failed and rolled back; $old_volume and $DUMP_FILE are unchanged"

dump_file_quoted=$(printf '%q' "$DUMP_FILE")
cat <<EOF
Done. $DB_NAME now runs on PostgreSQL 18 in $new_volume.

Next:
  make docker-up
  uv run manage.py migrate
Once the app works with your data:
  docker volume rm $old_volume
  rm -- $dump_file_quoted
EOF

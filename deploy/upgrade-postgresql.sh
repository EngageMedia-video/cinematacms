#!/bin/bash
# Upgrades an installed server's PostgreSQL cluster to PostgreSQL 18 with
# pg_upgradecluster in copy mode, so the old cluster stays intact for rollback.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# install.sh returns before its main body when sourced; it provides
# install_postgresql and POSTGRESQL_MAJOR_VERSION.
# shellcheck source=SCRIPTDIR/../install.sh
source "$SCRIPT_DIR/../install.sh"

TARGET_VERSION="$POSTGRESQL_MAJOR_VERSION"
CREATECLUSTER_CONF="${CINEMATA_CREATECLUSTER_CONF:-/etc/postgresql-common/createcluster.conf}"
# Unique per run, so the cleanup can only ever drop the cluster this run made.
PRECHECK_CLUSTER="upgrade-check-$$"
PRECHECK_CREATED=false
NEW_CLUSTER_ROOT=/var/lib/postgresql
# Copy mode needs room for a second copy of the data plus headroom.
FREE_SPACE_PERCENT=110

usage() {
    cat <<'EOF'
Usage: sudo ./deploy/upgrade-postgresql.sh COMMAND

Commands:
  prepare   Install PostgreSQL 18 beside the running cluster and run
            pg_upgrade --check against it. Safe while the site is live.
  upgrade   Copy the cluster into PostgreSQL 18 on the same port.
            Stop every database client first.
  rollback  Stop PostgreSQL 18 and bring the old cluster back on its port.
            Writes made on PostgreSQL 18 are lost. Safe to re-run if it
            was interrupted.
EOF
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

as_postgres() {
    runuser -u postgres -- "$@"
}

# Prints "version name port status datadir" for each cluster.
list_clusters() {
    pg_lsclusters --no-header | awk '{ print $1, $2, $3, $4, $6 }'
}

# The single cluster that is not on the target version.
read_source_cluster() {
    local candidates
    candidates=$(list_clusters | awk -v target="$TARGET_VERSION" '$1 != target')
    [ -n "$candidates" ] || fail "no cluster older than PostgreSQL $TARGET_VERSION found"
    [ "$(printf '%s\n' "$candidates" | wc -l)" -eq 1 ] || \
        fail "more than one cluster could be upgraded; this script handles exactly one:"$'\n'"$candidates"
    read -r SOURCE_VERSION SOURCE_NAME SOURCE_PORT SOURCE_STATUS SOURCE_DATADIR <<<"$candidates"
    UPGRADE_RECORD="$NEW_CLUSTER_ROOT/upgrade-postgresql-$SOURCE_VERSION-$SOURCE_NAME.state"
}

target_cluster_exists() {
    list_clusters | awk -v target="$TARGET_VERSION" -v name="$1" '$1 == target && $2 == name { found = 1 } END { exit !found }'
}

cluster_field() {
    list_clusters | awk -v version="$1" -v name="$2" -v field="$3" '$1 == version && $2 == name { print $field }'
}

source_psql() {
    as_postgres psql -X -p "$SOURCE_PORT" -d postgres -Atqc "$1"
}

# Prints "database schema.table rows" for every user table in every database
# on the cluster at SOURCE_PORT, which is the new cluster once the upgrade ran.
count_table_rows() {
    local databases database counts
    databases=$(source_psql "SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate ORDER BY 1") || return 1
    while IFS= read -r database; do
        counts=$(as_postgres psql -X -p "$SOURCE_PORT" -d "$database" -Atq -v ON_ERROR_STOP=1 <<'SQL'
SELECT format('SELECT %L || '' '' || count(*) FROM %I.%I', schemaname || '.' || relname, schemaname, relname)
FROM pg_stat_user_tables ORDER BY schemaname, relname
\gexec
SQL
        ) || return 1
        [ -z "$counts" ] || awk -v database="$database" '{ print database, $0 }' <<<"$counts"
    done <<<"$databases"
}

start_conf() {
    printf '%s\n' "/etc/postgresql/$1/$2/start.conf"
}

# systemd caches which clusters start with postgresql.service; it must re-read
# start.conf after a change.
reload_cluster_startup() {
    if [ -d /run/systemd/system ]; then
        systemctl daemon-reload
    fi
}

# start.conf only feeds postgresql.service. A host can also enable a cluster's
# own unit, which starts it at boot regardless of start.conf; that enablement
# must move to the cluster that now serves the port.
move_unit_enablement() {
    local from_unit="postgresql@$1-$3" to_unit="postgresql@$2-$3"
    [ -d /run/systemd/system ] || return 0
    [ "$(systemctl is-enabled "$from_unit" 2>/dev/null || true)" = enabled ] || return 0
    systemctl disable "$from_unit"
    systemctl enable "$to_unit"
}

disable_automatic_main_cluster() {
    if grep -Eq '^[[:space:]]*create_main_cluster[[:space:]]*=' "$CREATECLUSTER_CONF"; then
        sed -i -E 's/^[[:space:]]*create_main_cluster[[:space:]]*=.*/create_main_cluster = false/' "$CREATECLUSTER_CONF"
    else
        echo "create_main_cluster = false" >>"$CREATECLUSTER_CONF"
    fi
}

drop_precheck_cluster() {
    if [ "$PRECHECK_CREATED" = true ]; then
        pg_dropcluster --stop "$TARGET_VERSION" "$PRECHECK_CLUSTER"
        PRECHECK_CREATED=false
    fi
}

# pg_upgrade --check needs an empty target cluster whose checksum setting
# matches the source; PostgreSQL 18 initdb enables checksums by default.
check_upgrade_compatibility() {
    local checksum_option="--no-data-checksums"
    local precheck_port
    if [ "$(source_psql 'SHOW data_checksums')" = "on" ]; then
        checksum_option="--data-checksums"
    fi
    ! target_cluster_exists "$PRECHECK_CLUSTER" || fail "cluster $TARGET_VERSION/$PRECHECK_CLUSTER already exists"
    trap drop_precheck_cluster EXIT
    pg_createcluster "$TARGET_VERSION" "$PRECHECK_CLUSTER" -- "$checksum_option" >/dev/null
    PRECHECK_CREATED=true
    precheck_port=$(cluster_field "$TARGET_VERSION" "$PRECHECK_CLUSTER" 3)
    # pg_upgrade needs a working directory that postgres can write to.
    cd "$NEW_CLUSTER_ROOT"
    as_postgres "/usr/lib/postgresql/$TARGET_VERSION/bin/pg_upgrade" --check \
        -b "/usr/lib/postgresql/$SOURCE_VERSION/bin" \
        -B "/usr/lib/postgresql/$TARGET_VERSION/bin" \
        -d "$SOURCE_DATADIR" \
        -D "$NEW_CLUSTER_ROOT/$TARGET_VERSION/$PRECHECK_CLUSTER" \
        -o "-c config_file=/etc/postgresql/$SOURCE_VERSION/$SOURCE_NAME/postgresql.conf" \
        -O "-c config_file=/etc/postgresql/$TARGET_VERSION/$PRECHECK_CLUSTER/postgresql.conf" \
        -p "$SOURCE_PORT" -P "$precheck_port" \
        || fail "pg_upgrade --check found a problem; see its report above"
    drop_precheck_cluster
    trap - EXIT
}

require_no_database_clients() {
    local clients
    clients=$(source_psql "SELECT usename || ' ' || coalesce(application_name, '') || ' ' || coalesce(client_addr::text, 'local')
        FROM pg_stat_activity WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()")
    [ -z "$clients" ] || fail "stop every database client first; still connected:"$'\n'"$clients"
}

mount_point() {
    df -Pk "$1" | awk 'NR == 2 { print $6 }'
}

# Prints "mount_point kilobytes" for the copy of source_path written to dest_path.
copy_space_line() {
    local dest_path=$1 source_path=$2 mount used_kb
    mount=$(mount_point "$dest_path") || return 1
    used_kb=$(du -sk "$source_path" | awk '{ print $1 }') || return 1
    [ -n "$mount" ] && [[ "$used_kb" =~ ^[0-9]+$ ]] || return 1
    echo "$mount $used_kb"
}

# Prints one line per place copy mode writes to: the new data directory and,
# for each tablespace, a new directory beside the old one.
space_needed_by_copy() {
    local locations location
    copy_space_line "$NEW_CLUSTER_ROOT" "$SOURCE_DATADIR" || return 1
    locations=$(source_psql "SELECT pg_tablespace_location(oid) FROM pg_tablespace WHERE pg_tablespace_location(oid) <> ''") || return 1
    while IFS= read -r location; do
        [ -z "$location" ] || copy_space_line "$location" "$location" || return 1
    done <<<"$locations"
}

require_free_space_for_copy() {
    local needed mount used_kb required_kb available_kb
    needed=$(space_needed_by_copy) || fail "could not measure the space copy mode needs"
    needed=$(awk '{ needed[$1] += $2 } END { for (mount in needed) print mount, needed[mount] }' <<<"$needed")
    [ -n "$needed" ] || fail "could not measure the space copy mode needs"
    while read -r mount used_kb; do
        required_kb=$((used_kb * FREE_SPACE_PERCENT / 100))
        available_kb=$(df -Pk "$mount" | awk 'NR == 2 { print $4 }')
        [[ "$available_kb" =~ ^[0-9]+$ ]] || fail "could not read the free space on $mount"
        [ "$available_kb" -ge "$required_kb" ] || \
            fail "copy mode needs about $((required_kb / 1024)) MiB free on $mount; $((available_kb / 1024)) MiB available"
    done <<<"$needed"
}

prepare() {
    read_source_cluster
    [ "$SOURCE_STATUS" = "online" ] || fail "cluster $SOURCE_VERSION/$SOURCE_NAME must be running for the check"
    ! target_cluster_exists "$SOURCE_NAME" || \
        fail "cluster $TARGET_VERSION/$SOURCE_NAME already exists; drop it if it is empty, or run rollback"
    disable_automatic_main_cluster
    # Installing PostgreSQL 18 also upgrades postgresql-common. Its ucf prompt
    # about the createcluster.conf edited above would wait forever on a terminal
    # nobody watches, and the edit must be kept.
    DEBIAN_FRONTEND=noninteractive UCF_FORCE_CONFFOLD=1 install_postgresql
    check_upgrade_compatibility
    echo "PostgreSQL $TARGET_VERSION is installed and cluster $SOURCE_VERSION/$SOURCE_NAME passed pg_upgrade --check."
}

upgrade() {
    local original_start rows_before rows_after
    read_source_cluster
    rows_before="$UPGRADE_RECORD.rows-before"
    rows_after="$UPGRADE_RECORD.rows-after"
    ! target_cluster_exists "$SOURCE_NAME" || \
        fail "cluster $TARGET_VERSION/$SOURCE_NAME already exists; the upgrade has already run. After a rollback, drop it with pg_dropcluster $TARGET_VERSION $SOURCE_NAME to upgrade again"
    [ "$SOURCE_STATUS" = "online" ] || fail "cluster $SOURCE_VERSION/$SOURCE_NAME must be running so its clients can be checked"
    require_no_database_clients
    [ -x "/usr/lib/postgresql/$TARGET_VERSION/bin/postgres" ] || fail "PostgreSQL $TARGET_VERSION is not installed; run prepare first"
    require_free_space_for_copy
    original_start=$(awk '!/^[[:space:]]*(#|$)/ { print $1; exit }' "$(start_conf "$SOURCE_VERSION" "$SOURCE_NAME")")
    # Written before the upgrade so a rollback can restore the old cluster's
    # port and startup policy even if this run is interrupted.
    printf 'original_port=%s\noriginal_start=%s\n' "$SOURCE_PORT" "${original_start:-auto}" >"$UPGRADE_RECORD"
    rm -f "$UPGRADE_RECORD.rolled-back"
    echo "Counting the rows in every table of $SOURCE_VERSION/$SOURCE_NAME"
    count_table_rows >"$rows_before" || fail "could not count the rows in $SOURCE_VERSION/$SOURCE_NAME"
    pg_upgradecluster -v "$TARGET_VERSION" -m upgrade "$SOURCE_VERSION" "$SOURCE_NAME"
    # The old cluster stays as the rollback copy; keep it from starting at boot.
    echo manual >"$(start_conf "$SOURCE_VERSION" "$SOURCE_NAME")"
    move_unit_enablement "$SOURCE_VERSION" "$TARGET_VERSION" "$SOURCE_NAME"
    reload_cluster_startup
    echo "Counting the rows in every table of $TARGET_VERSION/$SOURCE_NAME"
    count_table_rows >"$rows_after" || fail "could not count the rows in $TARGET_VERSION/$SOURCE_NAME; keep the clients stopped and run rollback"
    diff "$rows_before" "$rows_after" || \
        fail "row counts differ between $SOURCE_VERSION/$SOURCE_NAME and $TARGET_VERSION/$SOURCE_NAME (shown above); keep the clients stopped and run rollback"
    echo "Row counts match in all $(wc -l <"$rows_after") tables ($rows_after)."
    echo "Cluster $SOURCE_VERSION/$SOURCE_NAME now runs as $TARGET_VERSION/$SOURCE_NAME on port $SOURCE_PORT."
    echo "The old cluster is stopped and kept for rollback. Drop it once you no longer need it:"
    echo "  pg_dropcluster $SOURCE_VERSION $SOURCE_NAME"
}

record_value() {
    sed -n "s/^$1=//p" "$UPGRADE_RECORD"
}

# Every step sets a final state rather than toggling one, so an interrupted
# rollback can be run again.
rollback() {
    local original_port original_start target_port backup_port
    read_source_cluster
    target_cluster_exists "$SOURCE_NAME" || fail "cluster $TARGET_VERSION/$SOURCE_NAME does not exist; nothing to roll back"
    if [ ! -f "$UPGRADE_RECORD" ]; then
        [ ! -f "$UPGRADE_RECORD.rolled-back" ] || fail "the rollback has already run; $SOURCE_VERSION/$SOURCE_NAME is the active cluster"
        fail "no upgrade record at $UPGRADE_RECORD; this script did not upgrade $SOURCE_VERSION/$SOURCE_NAME"
    fi
    original_port=$(record_value original_port)
    original_start=$(record_value original_start)
    target_port=$(cluster_field "$TARGET_VERSION" "$SOURCE_NAME" 3)
    if [ "$target_port" = "$original_port" ]; then
        backup_port="$SOURCE_PORT"
    else
        backup_port="$target_port"
    fi
    [ "$backup_port" != "$original_port" ] || fail "both clusters use port $original_port; fix the ports by hand"

    [ "$(cluster_field "$TARGET_VERSION" "$SOURCE_NAME" 4)" = "down" ] || pg_ctlcluster "$TARGET_VERSION" "$SOURCE_NAME" stop
    [ "$SOURCE_STATUS" = "down" ] || pg_ctlcluster "$SOURCE_VERSION" "$SOURCE_NAME" stop
    pg_conftool "$TARGET_VERSION" "$SOURCE_NAME" set port "$backup_port"
    pg_conftool "$SOURCE_VERSION" "$SOURCE_NAME" set port "$original_port"
    echo manual >"$(start_conf "$TARGET_VERSION" "$SOURCE_NAME")"
    echo "$original_start" >"$(start_conf "$SOURCE_VERSION" "$SOURCE_NAME")"
    move_unit_enablement "$TARGET_VERSION" "$SOURCE_VERSION" "$SOURCE_NAME"
    reload_cluster_startup
    pg_ctlcluster "$SOURCE_VERSION" "$SOURCE_NAME" start
    [ "$(cluster_field "$SOURCE_VERSION" "$SOURCE_NAME" 4)" = "online" ] || \
        fail "cluster $SOURCE_VERSION/$SOURCE_NAME did not start; fix the cause and run rollback again"
    mv "$UPGRADE_RECORD" "$UPGRADE_RECORD.rolled-back"
    echo "Cluster $SOURCE_VERSION/$SOURCE_NAME runs again on port $original_port. $TARGET_VERSION/$SOURCE_NAME is stopped on port $backup_port."
}

[ "$#" -eq 1 ] || { usage >&2; exit 1; }
case "$1" in
    -h|--help)
        usage
        exit 0
        ;;
    prepare|upgrade|rollback)
        [ "$(id -u)" -eq 0 ] || fail "run this command as root"
        "$1"
        ;;
    *)
        usage >&2
        fail "unknown command: $1"
        ;;
esac

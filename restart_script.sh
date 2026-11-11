#!/bin/bash
set -e

# Cinemata restart script after code changes
# Run as root

# Each release holds one frontend: build/ is the Vite output with its manifest and
# collected/ is what collectstatic made of it. `current` names the release that is
# served and `previous` the one that was served before it.
STATIC_RELEASES=static_releases
# STATIC_ROOT of cms/settings.py, which nginx serves as /static/.
COLLECTED_STATIC=static_collected
COLLECTED_STATIC_LINK=$STATIC_RELEASES/current/collected
# The Vite build in STATICFILES_DIRS of cms/settings.py, where django-vite reads the manifest.
FRONTEND_BUILD=frontend/build/production/static
FRONTEND_BUILD_LINK=../../../$STATIC_RELEASES/current/build

restart_usage() {
  echo "Usage: $0 [--no-pull | --revision COMMIT_SHA [--frontend-artifact DIRECTORY]]" >&2
}

parse_restart_args() {
  PULL_LATEST=true
  DEPLOY_REVISION=""
  FRONTEND_ARTIFACT_DIR=""
  case "${1:-}" in
    --no-pull)
      if [ "$#" -ne 1 ]; then
        restart_usage
        return 2
      fi
      PULL_LATEST=false
      ;;
    --revision)
      if ! [[ "${2:-}" =~ ^[0-9a-f]{40}$ ]]; then
        echo "--revision requires a full 40-character lowercase commit SHA" >&2
        return 2
      fi
      DEPLOY_REVISION="$2"
      if [ "$#" -eq 4 ] && [ "$3" = --frontend-artifact ] && [[ "$4" = /* ]]; then
        FRONTEND_ARTIFACT_DIR="$4"
      elif [ "$#" -ne 2 ]; then
        restart_usage
        return 2
      fi
      ;;
    "")
      ;;
    *)
      restart_usage
      return 2
      ;;
  esac
}

select_release() {
  if [ -n "$DEPLOY_REVISION" ]; then
    echo "Deploying requested commit $DEPLOY_REVISION..."
    git fetch origin "$DEPLOY_REVISION"
    git merge --ff-only "$DEPLOY_REVISION"
    # A fast-forward to a commit that the checkout already contains succeeds and moves nothing.
    local checked_out
    checked_out=$(git rev-parse HEAD)
    if [ "$checked_out" != "$DEPLOY_REVISION" ]; then
      echo "Error: the checkout is at $checked_out, which is later than the requested commit $DEPLOY_REVISION." >&2
      echo "Nothing was deployed. Request $checked_out or a later commit." >&2
      return 1
    fi
  elif [ "$PULL_LATEST" = true ]; then
    echo "Pulling latest changes from git repository..."
    git pull --ff-only
  fi
}

install_frontend_dependencies() {
  echo "Installing frontend dependencies..."
  (
    cd frontend
    npm ci --no-fund --no-audit
  )
}

# rename(2) puts the new link in place of the old one in one step.
point_symlink() {
  local link=$1 target=$2
  rm -rf "$link.new" &&
    ln -s "$target" "$link.new" &&
    python3 -c 'import os, sys; os.replace(sys.argv[1], sys.argv[2])' "$link.new" "$link"
}

linked_release() {
  readlink "$STATIC_RELEASES/$1" 2>/dev/null || true
}

release_revision() {
  cat "$STATIC_RELEASES/$1/REVISION" 2>/dev/null || true
}

# A deploy that stopped leaves a release that no link names. Its build or its
# collectstatic can still be running, so no later deploy writes into that directory again.
# It can also leave the link that it was about to rename into place.
prune_static_releases() {
  local release
  rm -f "$STATIC_RELEASES/current.new" "$STATIC_RELEASES/previous.new"
  for release in "$STATIC_RELEASES"/release.*; do
    case "${release##*/}" in
      "$(linked_release current)" | "$(linked_release previous)") continue ;;
    esac
    [ ! -d "$release" ] || rm -rf "$release" || echo "Warning: could not delete $release." >&2
  done
}

# Every build and every collectstatic writes into a release that no link names yet,
# so a run that outlives its deploy cannot change a release that is served later.
new_static_release() {
  prune_static_releases
  NEW_STATIC_RELEASE=$(mktemp -d "$STATIC_RELEASES/release.XXXXXX")
  chmod 755 "$NEW_STATIC_RELEASE"
}

unpack_frontend_artifact() {
  echo "Checking the prebuilt frontend for $DEPLOY_REVISION..."
  python3 deploy/frontend-artifact.py unpack \
    --artifact-dir "$FRONTEND_ARTIFACT_DIR" --commit "$DEPLOY_REVISION" --target "$NEW_STATIC_RELEASE/build"
  echo "$DEPLOY_REVISION" > "$NEW_STATIC_RELEASE/REVISION"
}

# The command names the directory, because vite.config.js names the one that is served.
build_frontend_from_source() {
  local build=$PWD/$NEW_STATIC_RELEASE/build
  (
    cd frontend
    npm run build -- --outDir "$build" --emptyOutDir
  )
}

serves_from_current_release() {
  [ "$(readlink "$COLLECTED_STATIC" 2>/dev/null || true)" = "$COLLECTED_STATIC_LINK" ] &&
    [ "$(readlink "$FRONTEND_BUILD" 2>/dev/null || true)" = "$FRONTEND_BUILD_LINK" ] &&
    [ -d "$COLLECTED_STATIC" ] && [ -d "$FRONTEND_BUILD" ]
}

# -a keeps each file's time, which collectstatic compares with the time of its source.
copy_directory() {
  local source=$1 copy=$2
  mkdir "$copy"
  [ ! -d "$source" ] || cp -a "$source/." "$copy/"
}

link_served_path() {
  local path=$1 target=$2
  if [ -d "$path" ] && [ ! -L "$path" ]; then
    ln -s "$target" "$path.new"
    if ! python3 deploy/exchange-paths.py "$path.new" "$path"; then
      echo "Error: $path is still a directory. See \"Swap the directories by hand\" in deploy/README.md." >&2
      return 1
    fi
    rm -rf "$path.new"
  else
    mkdir -p "$(dirname "$path")"
    point_symlink "$path" "$target"
  fi
}

# A host that serves the two directories themselves gets a release that holds a copy
# of them, and then a link in place of each directory. Nothing that is served changes.
adopt_served_frontend() {
  mkdir -p "$STATIC_RELEASES"
  # nginx reads through this directory before the deploy resets the ownership.
  chmod 755 "$STATIC_RELEASES"
  rm -rf "$COLLECTED_STATIC.new" "$FRONTEND_BUILD.new"
  if serves_from_current_release; then
    return 0
  fi
  echo "Moving the served frontend into $STATIC_RELEASES..."
  local release
  release=$(mktemp -d "$STATIC_RELEASES/release.XXXXXX")
  chmod 755 "$release"
  copy_directory "$COLLECTED_STATIC" "$release/collected"
  copy_directory "$FRONTEND_BUILD" "$release/build"
  chown -R www-data: "$release"
  sync
  point_symlink "$STATIC_RELEASES/current" "${release##*/}"
  link_served_path "$COLLECTED_STATIC" "$COLLECTED_STATIC_LINK"
  link_served_path "$FRONTEND_BUILD" "$FRONTEND_BUILD_LINK"
}

# Django takes the build and the destination of collectstatic from its settings, and
# the settings of every commit name the directories that are served. This run reads a
# settings module that names two other directories instead.
collect_static_files() {
  local build=$1 collected=$2 settings status=0
  settings=$(mktemp -d)
  cat > "$settings/static_release_settings.py" <<'SETTINGS'
import os

from cms.settings import *

served_build = os.path.join(BASE_DIR, os.environ["SERVED_FRONTEND_BUILD"])
if served_build not in STATICFILES_DIRS:
    raise SystemExit(f"Error: STATICFILES_DIRS in cms/settings.py does not name {served_build}.")
build = os.environ["STATIC_RELEASE_BUILD"]
STATIC_ROOT = os.environ["STATIC_RELEASE_COLLECTED"]
STATICFILES_DIRS = [build if directory == served_build else directory for directory in STATICFILES_DIRS]
DJANGO_VITE["default"]["manifest_path"] = os.path.join(build, ".vite", "manifest.json")
SETTINGS
  PYTHONPATH="$settings${PYTHONPATH:+:$PYTHONPATH}" DJANGO_SETTINGS_MODULE=static_release_settings \
    SERVED_FRONTEND_BUILD="$FRONTEND_BUILD" STATIC_RELEASE_BUILD="$build" STATIC_RELEASE_COLLECTED="$collected" \
    python manage.py collectstatic --noinput || status=$?
  rm -rf "$settings"
  return "$status"
}

# A worker that is still running renders the bundle names of the manifest that it
# read, so a new release starts with the files that the served one holds.
keep_served_files_in_new_release() {
  copy_directory "$COLLECTED_STATIC_LINK" "$NEW_STATIC_RELEASE/collected"
}

collect_static_release() {
  echo "Collecting static files into $NEW_STATIC_RELEASE..."
  keep_served_files_in_new_release
  collect_static_files "$PWD/$NEW_STATIC_RELEASE/build" "$PWD/$NEW_STATIC_RELEASE/collected"
}

# After a host crash, the disk must not hold a link without the files behind it.
write_new_release_to_disk() {
  chown -R www-data: "$NEW_STATIC_RELEASE"
  sync
}

activate_static_release() {
  write_new_release_to_disk
  point_symlink "$STATIC_RELEASES/previous" "$(linked_release current)"
  point_symlink "$STATIC_RELEASES/current" "${NEW_STATIC_RELEASE##*/}"
  echo "Now serving the frontend from $NEW_STATIC_RELEASE."
  prune_static_releases
}

# The files of the previous release win over the files that the served release adds.
republish_previous_static_release() {
  local replaced
  new_static_release
  copy_directory "$STATIC_RELEASES/previous/build" "$NEW_STATIC_RELEASE/build"
  keep_served_files_in_new_release
  cp -a "$STATIC_RELEASES/previous/collected/." "$NEW_STATIC_RELEASE/collected/"
  cp -a "$STATIC_RELEASES/previous/REVISION" "$NEW_STATIC_RELEASE/REVISION"
  write_new_release_to_disk
  replaced=$(linked_release current)
  # `previous` names a release of the commit until `current` does, so a rollback that
  # stops between the two renames finds one when it runs again.
  point_symlink "$STATIC_RELEASES/current" "${NEW_STATIC_RELEASE##*/}"
  point_symlink "$STATIC_RELEASES/previous" "$replaced"
  prune_static_releases
}

# rollback.sh runs this after it checked out the commit and installed its packages.
roll_back_static_release() {
  local revision=$1
  if [ "$(release_revision current)" = "$revision" ]; then
    echo "The served frontend is already the one that was deployed for $revision."
    prune_static_releases
  elif [ "$(release_revision previous)" = "$revision" ]; then
    republish_previous_static_release
    echo "Now serving the frontend that was deployed for $revision."
  else
    echo "No release holds the frontend of $revision. Building it from source..."
    new_static_release
    if ! build_frontend_from_source; then
      echo "Error: the frontend build failed. The checkout is at $revision and the served frontend is unchanged." >&2
      return 1
    fi
    collect_static_release
    activate_static_release
  fi
}

# The Collector rereads a log from its first line after losing read access to it,
# so the logs keep the Collector's group for the whole reset.
reset_app_ownership() {
  if [ -d logs ] && getent group cinematacms-observability >/dev/null; then
    find /home/cinemata/ -path "$PWD/logs" -prune -o -exec chown -h www-data: {} +
    chown -R www-data:cinematacms-observability logs
  else
    chown -R www-data. /home/cinemata/
  fi
}

restart_application_services() {
  systemctl restart mediacms celery_long celery_short celery_whisper celery_email celery_beat
}

# Python imports modules lazily, so a process that outlives a pip install can load
# a new module beside an old one it imported earlier and fail.
restart_application_services_after_interrupted_deploy() {
  local status=$?
  trap - EXIT
  echo "The deploy stopped after the Python packages changed. Restarting the application services." >&2
  systemctl daemon-reload || echo "Error: systemctl daemon-reload failed." >&2
  restart_application_services || echo "Error: the application services did not restart. Restart them by hand." >&2
  exit "$status"
}

main() {
parse_restart_args "$@"

if [ `id -u` -ne 0 ]
  then echo "Please run as root"
  exit 1
fi

echo "Starting Cinemata restart process..."

# Navigate to cinemata directory
cd /home/cinemata

# Activate virtual environment
source /home/cinemata/bin/activate

# Navigate to cinematacms directory
cd cinematacms

# Both steps can fail, and neither changes what is served, so they run before the
# checkout moves and before the Python packages change.
adopt_served_frontend
if [ -n "$FRONTEND_ARTIFACT_DIR" ]; then
  new_static_release
  unpack_frontend_artifact
fi

# Record current commit so rollback.sh can find the previous deployment.
DEPLOY_LOG=/var/log/cinemata/deploy.log
mkdir -p "$(dirname "$DEPLOY_LOG")"
PREV_SHA="${CINEMATA_PREV_SHA:-$(git rev-parse HEAD)}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

select_release

# Append a deploy-log entry only when the pull actually advanced HEAD.
NEW_SHA=$(git rev-parse HEAD)
if [ "$NEW_SHA" != "$PREV_SHA" ]; then
  printf '%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PREV_SHA" "$NEW_SHA" "$BRANCH" \
    >> "$DEPLOY_LOG"
  echo "Recorded deploy in $DEPLOY_LOG (was $PREV_SHA, now $NEW_SHA)."
fi

trap restart_application_services_after_interrupted_deploy EXIT

# Install any new requirements
echo "Installing any new requirements..."
pip install -r requirements.txt

# Reconcile the single runtime environment before Django or systemd reads it.
deploy/apply-release-config.sh --no-restart
set -a
# shellcheck source=/etc/cinematacms/app.env
source /etc/cinematacms/app.env
set +a

if [ -z "$FRONTEND_ARTIFACT_DIR" ]; then
  install_frontend_dependencies
  echo "Building frontend..."
  new_static_release
  if ! build_frontend_from_source; then
    echo "Frontend build failed. Aborting restart."
    exit 1
  fi
fi
collect_static_release
activate_static_release
# Apply database migrations
echo "Applying database migrations..."
if ! python manage.py migrate; then
  echo "Database migrations failed. Aborting restart."
  exit 1
fi
python manage.py backfill_media_storage_usage || echo "Warning: storage usage backfill encountered errors; continuing restart."

# Update ownership
echo "Updating ownership..."
reset_app_ownership

# Reload systemd unit files in case service definitions changed
echo "Reloading systemd daemon..."
for unit in mediacms celery_long celery_short celery_whisper celery_email celery_beat; do
  install -m 0644 "deploy/$unit.service" "/etc/systemd/system/$unit.service"
done
systemctl daemon-reload

# Restart services
echo "Restarting services..."
systemctl enable mediacms celery_long celery_short celery_whisper celery_email celery_beat
restart_application_services
trap - EXIT
systemctl restart nginx

echo "Cinemata restart completed successfully!"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi

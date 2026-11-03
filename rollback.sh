#!/bin/bash
# Cinemata rollback script — emergency brake.
# Reverts the most recent deploy by reading /var/log/cinemata/deploy.log
# and checking out the commit that was HEAD before the last successful
# `git pull` performed by restart_script.sh, then re-runs the build and
# service restart sequence.
#
# Does NOT run `manage.py migrate`. If migrations changed between deploys
# the operator must reverse them by hand after rollback (see the warning
# block this script prints).
#
# Run as root.

set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

trap 'echo -e "${RED}Error at ${BASH_SOURCE[0]}:${LINENO}${NC}" >&2; exit 1' ERR

DEPLOY_LOG=/var/log/cinemata/deploy.log
CINEMATA_HOME=/home/cinemata
REPO_DIR="${CINEMATA_HOME}/cinematacms"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      cat <<USAGE
Usage: sudo $0 [--dry-run]

Rolls back the most recent Cinemata deploy by checking out the commit that
was HEAD before the last successful 'git pull' run by restart_script.sh,
then re-runs the build + service restart sequence.

Does NOT run 'manage.py migrate' on the rolled-back code. If migrations
changed between deploys, you must reverse them manually after rollback.

Options:
  --dry-run   Show what would happen without making any changes.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}Please run as root.${NC}" >&2
  exit 1
fi

echo -e "${GREEN}Starting Cinemata rollback...${NC}"

cd "$CINEMATA_HOME"
# shellcheck disable=SC1091
source "${CINEMATA_HOME}/bin/activate"
cd "$REPO_DIR"

if [ ! -s "$DEPLOY_LOG" ]; then
  echo -e "${RED}No deploy log at $DEPLOY_LOG (or empty). Cannot rollback.${NC}" >&2
  echo -e "${YELLOW}A deploy log entry is written by restart_script.sh on each forward deploy.${NC}" >&2
  exit 1
fi

LAST_LINE=$(tail -n 1 "$DEPLOY_LOG")
LOG_TS=$(printf '%s' "$LAST_LINE" | cut -f1)
TARGET_SHA=$(printf '%s' "$LAST_LINE" | cut -f2)
DEPLOYED_SHA=$(printf '%s' "$LAST_LINE" | cut -f3)
DEPLOYED_BRANCH=$(printf '%s' "$LAST_LINE" | cut -f4)

if [ -z "$TARGET_SHA" ] || [ -z "$DEPLOYED_SHA" ]; then
  echo -e "${RED}Malformed deploy log entry: '$LAST_LINE'${NC}" >&2
  exit 1
fi

if ! git cat-file -e "${TARGET_SHA}^{commit}" 2>/dev/null; then
  echo -e "${RED}Target commit $TARGET_SHA is not present in the local repo.${NC}" >&2
  echo -e "${YELLOW}It may have been pruned. Try 'git fetch --all' and retry, or check out manually.${NC}" >&2
  exit 1
fi

CURRENT_SHA=$(git rev-parse HEAD)

if [ "$CURRENT_SHA" = "$TARGET_SHA" ]; then
  echo -e "${YELLOW}HEAD is already at $TARGET_SHA. Nothing to roll back.${NC}"
  exit 0
fi

# Sanity guard: the deploy log says the last forward deploy left HEAD at
# $DEPLOYED_SHA. If HEAD is somewhere else now, someone moved it out of
# band (manual git checkout, ad-hoc pull, an earlier rollback that wasn't
# logged) and the "previous deploy" recorded in the log may no longer be
# the right rollback target. Refuse to act and let the operator decide.
if [ "$CURRENT_SHA" != "$DEPLOYED_SHA" ]; then
  echo -e "${RED}Repository state has shifted since the last logged deploy.${NC}" >&2
  echo -e "${RED}  HEAD now:        $CURRENT_SHA${NC}" >&2
  echo -e "${RED}  Last deployed:   $DEPLOYED_SHA  (per $DEPLOY_LOG)${NC}" >&2
  echo -e "${RED}  Rollback target: $TARGET_SHA${NC}" >&2
  echo -e "${YELLOW}Refusing to roll back from a HEAD the deploy log does not know about.${NC}" >&2
  echo -e "${YELLOW}If you intended to roll back from the last deploy, run:${NC}" >&2
  echo -e "${YELLOW}  git fetch --all && git checkout $DEPLOYED_SHA${NC}" >&2
  echo -e "${YELLOW}then re-run this script. Otherwise check out the desired target manually.${NC}" >&2
  exit 1
fi

echo -e "${YELLOW}Most recent deploy log entry:${NC}"
echo "  Timestamp:  $LOG_TS"
echo "  Branch:     $DEPLOYED_BRANCH"
echo "  Was:        $TARGET_SHA"
echo "  Deployed:   $DEPLOYED_SHA"
echo
echo -e "${YELLOW}Commits that will be reverted (${TARGET_SHA}..HEAD):${NC}"
git log --oneline "${TARGET_SHA}..HEAD" || true
echo

MIGRATION_DIFF=$(git diff --name-only "${TARGET_SHA}" HEAD -- '*/migrations/*.py' || true)
DRIFT_APPS=""
if [ -n "$MIGRATION_DIFF" ]; then
  DRIFT_APPS=$(printf '%s\n' "$MIGRATION_DIFF" | awk -F/ '{print $1}' | sort -u | tr '\n' ' ')
  echo -e "${RED}WARNING: Database migrations changed between $TARGET_SHA and HEAD.${NC}"
  echo -e "${RED}Affected apps:${NC} $DRIFT_APPS"
  echo -e "${YELLOW}This script does NOT run 'migrate'. After rollback, if any of those${NC}"
  echo -e "${YELLOW}migrations modified the schema, you must reverse them by hand:${NC}"
  echo -e "${YELLOW}  python manage.py migrate <app> <previous_migration_name>${NC}"
  echo -e "${YELLOW}Use 'python manage.py showmigrations <app>' to find the right target.${NC}"
  echo
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo -e "${GREEN}Dry run complete. No changes made.${NC}"
  exit 0
fi

ans=""
read -r -p "Proceed with rollback to $TARGET_SHA? [y/N] " ans || true
case "$ans" in
  y|Y|yes|YES) ;;
  *)
    echo "Aborted by operator."
    exit 1
    ;;
esac

PRE_ROLLBACK_SHA=$(git rev-parse HEAD)

echo -e "${YELLOW}Checking out $TARGET_SHA (detached HEAD)...${NC}"
git checkout --detach "$TARGET_SHA"

echo -e "${YELLOW}Reinstalling Python requirements...${NC}"
pip install -r requirements.txt

echo -e "${YELLOW}Rebuilding frontend...${NC}"
if ! make quick-build; then
  echo -e "${RED}Frontend build failed at rolled-back commit.${NC}" >&2
  echo -e "${RED}You are now on detached HEAD $TARGET_SHA with a partial deploy.${NC}" >&2
  exit 1
fi

echo -e "${YELLOW}Updating ownership...${NC}"
# The Collector rereads a log from its first line after losing read access to it,
# so the logs keep the Collector's group for the whole reset.
if [ -d "$REPO_DIR/logs" ] && getent group cinematacms-observability >/dev/null; then
  find "$CINEMATA_HOME" -path "$REPO_DIR/logs" -prune -o -exec chown -h www-data: {} +
  chown -R www-data:cinematacms-observability "$REPO_DIR/logs"
else
  chown -R www-data. "$CINEMATA_HOME/"
fi

echo -e "${YELLOW}Reloading systemd daemon...${NC}"
systemctl daemon-reload

echo -e "${YELLOW}Restarting services...${NC}"
systemctl restart mediacms celery_long celery_short celery_whisper celery_email celery_beat
systemctl restart nginx

# Audit entry so a subsequent rollback (or the next forward deploy) can
# trace the chain. Field 4 is "rollback" instead of a branch name.
printf '%s\t%s\t%s\t%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PRE_ROLLBACK_SHA" "$TARGET_SHA" "rollback" \
  >> "$DEPLOY_LOG"

echo
echo -e "${GREEN}Rollback complete.${NC}"
echo "  HEAD now at: $(git rev-parse HEAD)"
echo "  Audit entry appended to $DEPLOY_LOG."
if [ -n "$DRIFT_APPS" ]; then
  echo
  echo -e "${RED}REMINDER: Migrations changed in apps:${NC} $DRIFT_APPS"
  echo -e "${RED}If any touched the schema, reverse them manually with${NC}"
  echo -e "${RED}'python manage.py migrate <app> <previous_migration_name>'.${NC}"
fi

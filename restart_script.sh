#!/bin/bash
set -e

# Cinemata restart script after code changes
# Run as root

PULL_LATEST=true
DEPLOY_REVISION=""
case "${1:-}" in
  --no-pull)
    PULL_LATEST=false
    ;;
  --revision)
    if [[ "${2:-}" =~ ^[0-9a-f]{40}$ ]] && [ "$#" -eq 2 ]; then
      DEPLOY_REVISION="$2"
    else
      echo "--revision requires a full 40-character lowercase commit SHA" >&2
      exit 2
    fi
    ;;
  "")
    ;;
  *)
    echo "Usage: $0 [--no-pull | --revision COMMIT_SHA]" >&2
    exit 2
    ;;
esac

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

# Record current commit so rollback.sh can find the previous deployment.
DEPLOY_LOG=/var/log/cinemata/deploy.log
mkdir -p "$(dirname "$DEPLOY_LOG")"
PREV_SHA="${CINEMATA_PREV_SHA:-$(git rev-parse HEAD)}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ -n "$DEPLOY_REVISION" ]; then
  echo "Deploying requested commit $DEPLOY_REVISION..."
  git fetch origin "$DEPLOY_REVISION"
  git merge --ff-only "$DEPLOY_REVISION"
elif [ "$PULL_LATEST" = true ]; then
  echo "Pulling latest changes from git repository..."
  git pull --ff-only
fi

# Append a deploy-log entry only when the pull actually advanced HEAD.
NEW_SHA=$(git rev-parse HEAD)
if [ "$NEW_SHA" != "$PREV_SHA" ]; then
  printf '%s\t%s\t%s\t%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PREV_SHA" "$NEW_SHA" "$BRANCH" \
    >> "$DEPLOY_LOG"
  echo "Recorded deploy in $DEPLOY_LOG (was $PREV_SHA, now $NEW_SHA)."
fi

# Install any new requirements
echo "Installing any new requirements..."
pip install -r requirements.txt

# Reconcile the single runtime environment before Django or systemd reads it.
deploy/apply-release-config.sh --no-restart
set -a
# shellcheck source=/etc/cinematacms/app.env
source /etc/cinematacms/app.env
set +a

# Build frontend and collect static files
echo "Building frontend and collecting static files..."
if ! make quick-build; then
  echo "Frontend build failed. Aborting restart."
  exit 1
fi
# Apply database migrations
echo "Applying database migrations..."
if ! python manage.py migrate; then
  echo "Database migrations failed. Aborting restart."
  exit 1
fi
python manage.py backfill_media_storage_usage || echo "Warning: storage usage backfill encountered errors; continuing restart."

# Update ownership
echo "Updating ownership..."
chown -R www-data. /home/cinemata/

# Reload systemd unit files in case service definitions changed
echo "Reloading systemd daemon..."
for unit in mediacms celery_long celery_short celery_whisper celery_email celery_beat; do
  install -m 0644 "deploy/$unit.service" "/etc/systemd/system/$unit.service"
done
systemctl daemon-reload

# Restart services
echo "Restarting services..."
systemctl enable mediacms celery_long celery_short celery_whisper celery_email celery_beat
systemctl restart mediacms celery_long celery_short celery_whisper celery_email celery_beat
systemctl restart nginx

echo "Cinemata restart completed successfully!"

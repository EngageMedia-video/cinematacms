#!/bin/bash
# Cinemata restart script after code changes
# Run as root

if [ `id -u` -ne 0 ]
  then echo "Please run as root"
  exit
fi

echo "Starting Cinemata restart process..."

# Navigate to cinemata directory
cd /home/cinemata

# Activate virtual environment
source /home/cinemata/bin/activate

# Navigate to cinematacms directory
cd cinematacms

# Pull latest changes from git
echo "Pulling latest changes from git repository..."
git pull

# Install any new requirements
echo "Installing any new requirements..."
pip install -r requirements.txt

# Apply database migrations
echo "Applying database migrations..."
python manage.py makemigrations
python manage.py migrate

# Update ownership
echo "Updating ownership..."
chown -R www-data. /home/cinemata/

# Restart services
echo "Restarting services..."
systemctl restart celery_long
systemctl restart celery_short
systemctl restart celery_beat
systemctl restart mediacms.service
systemctl restart celery_whisper.service
systemctl restart nginx

echo "Cinemata restart completed successfully!"

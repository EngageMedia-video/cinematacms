#!/bin/bash
# should be run as root and only on Ubuntu 22
echo "Welcome to the Cinemata installation!";

if [ `id -u` -ne 0 ]
  then echo "Please run as root"
  exit
fi


while true; do
    read -p "
This script will attempt to perform a system update, install required dependencies, install and configure PostgreSQL, NGINX, Redis and a few other utilities.
It is expected to run on a new system **with no running instances of any these services**. Make sure you check the script before you continue. Then enter yes or no
" yn
    case $yn in
        [Yy]* ) echo "OK!"; break;;
        [Nn]* ) echo "Have a great day"; exit;;
        * ) echo "Please answer yes or no.";;
    esac
done


osVersion=$(lsb_release -d)
if [[ $osVersion == *"Ubuntu 22"* ]]; then
    echo 'Performing system update and dependency installation, this will take a few minutes'
    apt-get update && apt-get -y upgrade && apt-get install python3-venv python3-dev python3-virtualenv python3-pip virtualenv redis-server postgresql nginx git gcc vim unzip ffmpeg imagemagick telnet htop certbot make build-essential libssl-dev zlib1g-dev  libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev  libncursesw5-dev xz-utils tk-dev libffi-dev liblzma-dev python3-openssl python3-certbot cmake libpq-dev python3-certbot-nginx -y
else
    echo "This script is tested for Ubuntu 22 versions only"
    exit
fi

# install ffmpeg
echo "Downloading and installing ffmpeg"
wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
mkdir -p tmp
tar -xf ffmpeg-release-amd64-static.tar.xz --strip-components 1 -C tmp
cp -v tmp/{ffmpeg,ffprobe,qt-faststart} /usr/local/bin
rm -rf tmp ffmpeg-release-amd64-static.tar.xz
echo "ffmpeg installed to /usr/local/bin"

read -p "Enter portal URL, or press enter for localhost : " FRONTEND_HOST
read -p "Enter portal name, or press enter for 'CinemataCMS : " PORTAL_NAME

[ -z "$PORTAL_NAME" ] && PORTAL_NAME='CinemataCMS'
[ -z "$FRONTEND_HOST" ] && FRONTEND_HOST='localhost'

echo 'Creating database to be used in CinemataCMS'

su -c "psql -c \"CREATE DATABASE mediacms\"" postgres
su -c "psql -c \"CREATE USER mediacms WITH ENCRYPTED PASSWORD 'mediacms'\"" postgres
su -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE mediacms TO mediacms\"" postgres

echo 'Installing Node.js v20 LTS...'
# Try to find install-nodejs.sh in the cinematacms directory
# The script may be run from different locations
if [ -f "/home/cinemata/cinematacms/install-nodejs.sh" ]; then
    NODEJS_SCRIPT="/home/cinemata/cinematacms/install-nodejs.sh"
elif [ -f "./install-nodejs.sh" ]; then
    NODEJS_SCRIPT="./install-nodejs.sh"
elif [ -f "install-nodejs.sh" ]; then
    NODEJS_SCRIPT="install-nodejs.sh"
else
    # Get the current script directory as fallback
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    NODEJS_SCRIPT="$SCRIPT_DIR/install-nodejs.sh"
fi

# Check if install-nodejs.sh exists
if [ ! -f "$NODEJS_SCRIPT" ]; then
    echo "Warning: install-nodejs.sh not found, attempting to create it..."

    # Create the install-nodejs.sh script inline
    cat > /tmp/install-nodejs.sh << 'EOF'
#!/bin/bash
set -e
echo "Installing Node.js v20 LTS via nvm..."

# Install for root user
export NVM_DIR="/root/.nvm"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

nvm install 20
nvm use 20
nvm alias default 20

# Also install for www-data user
su - www-data -s /bin/bash -c '
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    nvm alias default 20
' || true

echo "Node.js installation completed"
EOF
    chmod +x /tmp/install-nodejs.sh
    NODEJS_SCRIPT="/tmp/install-nodejs.sh"
fi

# Run the Node.js installation script
if [ -f "$NODEJS_SCRIPT" ]; then
    if bash "$NODEJS_SCRIPT"; then
        export NVM_DIR="/root/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        hash -r
    else
        echo "Error: Node.js installation script failed"; exit 1
    fi
else
    echo "Warning: Could not install Node.js - install script not found"; exit 1
fi
    echo "Warning: Could not install Node.js - install script not found"; exit 1
fi
    echo "Warning: Could not install Node.js - install script not found"; exit 1
fi

echo 'Creating python virtualenv on /home/cinemata'

cd /home/cinemata
virtualenv . --python=python3
source  /home/cinemata/bin/activate
cd cinematacms
pip install -r requirements.txt
cd .. && git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp/
bash ./models/download-ggml-model.sh large-v3
make
cd ../cinematacms

SECRET_KEY=`python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'`

# remove http or https prefix
FRONTEND_HOST=`echo "$FRONTEND_HOST" | sed -r 's/http:\/\///g'`
FRONTEND_HOST=`echo "$FRONTEND_HOST" | sed -r 's/https:\/\///g'`

sed -i s/localhost/$FRONTEND_HOST/g deploy/mediacms.io

FRONTEND_HOST_HTTP_PREFIX='http://'$FRONTEND_HOST

echo 'FRONTEND_HOST='\'"$FRONTEND_HOST_HTTP_PREFIX"\' >> cms/local_settings.py
echo 'PORTAL_NAME='\'"$PORTAL_NAME"\' >> cms/local_settings.py
echo "SSL_FRONTEND_HOST = FRONTEND_HOST.replace('http', 'https')" >> cms/local_settings.py

echo 'SECRET_KEY='\'"$SECRET_KEY"\' >> cms/local_settings.py
echo "LOCAL_INSTALL = True" >> cms/local_settings.py

mkdir logs
mkdir pids
python manage.py makemigrations files users actions
python manage.py migrate
# Build frontend if Node.js is available
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    echo "Building frontend assets..."
    if ! python manage.py build_frontend; then
        echo "Error: Frontend build failed. Aborting installation."; exit 1
    fi
else
    echo "Warning: Node.js/npm not found, skipping frontend build"
    echo "Running collectstatic only..."
    python manage.py collectstatic --noinput --verbosity=2
fi
    python manage.py build_frontend
else
    echo "Warning: Node.js/npm not found, skipping frontend build"
    echo "Running collectstatic only..."
    python manage.py collectstatic --noinput
fi

ADMIN_PASS=`python -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))"`
echo "from users.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASS')" | python manage.py shell

echo "from django.contrib.sites.models import Site; Site.objects.update(name='$FRONTEND_HOST', domain='$FRONTEND_HOST')" | python manage.py shell

chown -R www-data. /home/cinemata/
cp deploy/celery_long.service /etc/systemd/system/celery_long.service && systemctl enable celery_long && systemctl start celery_long
cp deploy/celery_short.service /etc/systemd/system/celery_short.service && systemctl enable celery_short && systemctl start celery_short
cp deploy/celery_beat.service /etc/systemd/system/celery_beat.service && systemctl enable celery_beat &&systemctl start celery_beat
cp deploy/mediacms.service /etc/systemd/system/mediacms.service && systemctl enable mediacms.service && systemctl start mediacms.service

cp deploy/celery_whisper.service /etc/systemd/system/celery_whisper.service && systemctl enable celery_whisper.service && systemctl start celery_whisper.service


mkdir -p /etc/letsencrypt/live/mediacms.io/
mkdir -p /etc/letsencrypt/live/$FRONTEND_HOST
mkdir -p /etc/nginx/sites-enabled
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/dhparams/
rm -rf /etc/nginx/conf.d/default.conf
rm -rf /etc/nginx/sites-enabled/default
cp deploy/mediacms.io_fullchain.pem /etc/letsencrypt/live/$FRONTEND_HOST/fullchain.pem
# this is just a self signed key, will be replaced by certbot
cp deploy/mediacms.io_privkey.pem /etc/letsencrypt/live/$FRONTEND_HOST/privkey.pem
cp deploy/dhparams.pem /etc/nginx/dhparams/dhparams.pem
cp deploy/mediacms.io /etc/nginx/sites-available/mediacms.io
ln -s /etc/nginx/sites-available/mediacms.io /etc/nginx/sites-enabled/mediacms.io
cp deploy/uwsgi_params /etc/nginx/sites-enabled/uwsgi_params
cp deploy/nginx.conf /etc/nginx/
systemctl stop nginx
systemctl start nginx

# attempt to get a valid certificate for specified domain

if [ "$FRONTEND_HOST" != "localhost" ]; then
    echo 'attempt to get a valid certificate for specified url $FRONTEND_HOST'
    certbot --nginx -n --agree-tos --register-unsafely-without-email -d $FRONTEND_HOST
    certbot --nginx -n --agree-tos --register-unsafely-without-email -d $FRONTEND_HOST
    # unfortunately for some reason it needs to be run two times in order to create the entries
    # and directory structure!!!
    systemctl restart nginx
else
    echo "will not call certbot utility to update ssl certificate for url 'localhost', using default ssl certificate"
fi

# Generate individual DH params
if [ "$FRONTEND_HOST" != "localhost" ]; then
    # Only generate new DH params when using "real" certificates.
    openssl dhparam -out /etc/nginx/dhparams/dhparams.pem 4096
    systemctl restart nginx
else
    echo "will not generate new DH params for url 'localhost', using default DH params"
fi

# Bento4 utility installation, for HLS

cd /home/cinemata/cinematacms
wget http://zebulon.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-632.x86_64-unknown-linux.zip
unzip Bento4-SDK-1-6-0-632.x86_64-unknown-linux.zip
mkdir -p /home/cinemata/cinematacms/media_files/hls

# Create user logos directory and default avatar
echo "Creating default user avatar..."
mkdir -p /home/cinemata/cinematacms/media_files/userlogos
wget -O /home/cinemata/cinematacms/media_files/userlogos/user.jpg https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y

# last, set default owner
chown -R www-data. /home/cinemata/

echo 'Cinemata installation completed, open browser on http://'"$FRONTEND_HOST"' and login with user admin and password '"$ADMIN_PASS"''

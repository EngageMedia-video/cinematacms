# About

__Implemented by [Jay Cruz](https://github.com/jmcruz14) and [King Catoy](https://github.com/Kingcatz)__ (Philippines)

This guide will help you set up Cinemata for local development on Mac OSX.

> [!WARNING]
> This guide has been tested for Mac OSX Ventura 13.0 and Sonoma 15.2. It may not work for versions below 13.0 so proceed accordingly.

# Steps

## Pre-installation

1. ### Install Homebrew
Homebrew is a package manager for Mac that makes it easy to install software. Open Terminal and run:

```zsh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, you will need to add Homebrew to your PATH to ensure Homebrew will work. The installation output will tell you if you need to do this and how.


2. ### Install required packaged
Install all the necessary software using Homebrew:

```zsh
brew install wget postgresql openssl ffmpeg make cmake python pyenv
```

3. ### Set up PostgreSQL
Start PostgreSQL using Homebrew and enable it to start automatically on succeeding logins:

```zsh
brew services start postgresql
```

4. ### Set up Redis using Docker
First, make sure Docker is installed. If not, download and install Docker Desktop for Mac from the [Docker website](https://www.docker.com/products/docker-desktop/).

Once Docker is running, create a Redis container:

```zsh
docker pull redis
docker run --name redis-cinemata -p 6379:6379 -d redis:latest
```

5. ### Create your working directory
Create a folder to hold all your project files:

```zsh
cd ~/Desktop
mkdir cinemata
cd cinemata
```

## Installation
1. ### Clone the repositories
First, clone the Cinemata repository:

```zsh
git clone https://github.com/EngageMedia-video/cinematacms cinematacms
cd cinematacms
```

Then clone the Whisper speech recognition repository:

```zsh
cd ..
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp/
sh ./models/download-ggml-model.sh large-v3
make
cd ..
```

2. ### Create environment files
Go back to the `/cinematacms` folder and create an `.env` file:

```zsh
cd cinematacms
touch .env
```

3. ### Set up PostgreSQL database
Open a new Terminal window and access PostgreSQL.

```zsh
psql postgres
```

In the PostgreSQL prompt, create the database and user:

```sql
CREATE DATABASE mediacms;
CREATE USER mediacms WITH ENCRYPTED PASSWORD 'mediacms';
GRANT ALL PRIVILEGES ON DATABASE mediacms TO mediacms;
```

4. ### Set up Python environment
Set up Python 3.10 as your local Python version:

```zsh
cd ~/Desktop/cinemata
pyenv install 3.10 # If you don't already have Python 3.10 installed

pyenv local 3.10
Create and activate a virtual environment:
python -m venv venv
source venv/bin/activate
```

Your terminal prompt should now show `(venv)` at the beginning.

5. ### Install Python packages
Install all required Python packages:

```zsh
cd cinematacms
pip install -r requirements.txt
```

6. ### Generate a secret key
Generate a secret key for Django:

```zsh
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Copy the output (this is your secret key)

7. ### Set up environment files
Open the `.env` file in a text editor:

```zsh
open -a TextEdit .env
```

The file will open blank. Type or paste the following, replacing `YOUR_SECRET_KEY_HERE` with the key you generated:

```zsh
SECRET_KEY='YOUR_SECRET_KEY_HERE'
```

Save and close the file.

Next, create the `local_settings.py` file within the `/cms` subfolder.

```zsh
cd cms
touch local_settings.py
open -a TextEdit local_settings.py
```

The file will open blank. Copy and paste the following content:

```python
import os
from dotenv import load_dotenv
load_dotenv()

BASE_DIR = os.path.abspath('.')

FRONTEND_HOST='http://127.0.0.1:8000'
PORTAL_NAME='CinemataCMS'
SSL_FRONTEND_HOST=FRONTEND_HOST.replace('http', 'https')
SECRET_KEY=os.getenv('SECRET_KEY')
LOCAL_INSTALL=True
DEBUG = True
STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, "static")]
STATIC_ROOT = os.path.join(BASE_DIR, 'static_collected')

# Whisper CPP directory
WHISPER_CPP_COMMAND = os.path.expanduser("~/Desktop/cinemata/whisper.cpp/main")
WHISPER_CPP_MODEL = os.path.expanduser("~/Desktop/cinemata/whisper.cpp/models/ggml-large-v3.bin")
```

Save and close the file.

8. ### Set up database and static files
Go back to the `/cinematacms` directory and create necessary folders and run the Django management commands:

```zsh
cd ..
mkdir logs
mkdir pids

python manage.py makemigrations files users actions
python manage.py migrate
python manage.py loaddata fixtures/encoding_profiles.json
python manage.py loaddata fixtures/categories.json
python manage.py collectstatic --noinput
```

9. ### Create an admin user
Create an admin user with a random password:

```zsh
ADMIN_PASS=$(python -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))")
echo "from users.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASS')" | python manage.py shell
echo "Your admin password is $ADMIN_PASS"
```

Write down the admin password that's displayed as this will let you access the Django admin panel.

10. ### Start the server
Finally, start the Django development server:

```zsh
python manage.py runserver
```

You should now be able to access Cinemata at http://127.0.0.1:8000 in your browser. To log in as admin, use:

- Username: admin
- Password: (the ADMIN_PASS that was displayed earlier)

## Troubleshooting
- #### PostgreSQL permission errors
If you encounter these, try granting full privileges:

```zsh
psql -U postgres

\c mediacms

GRANT USAGE, CREATE ON SCHEMA public TO mediacms;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mediacms;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mediacms;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO mediacms;

\q
```
## Additional Tips
- When the Terminal shows `(venv)` at the beginning of your prompt, it means your virtual environment is active
- To deactivate the virtual environment, simply type `deactivate` in the Terminal
- To activate it again, run `source ~/Desktop/cinemata/venv/bin/activate`
- If you close your Terminal and come back later, you'll need to activate the virtual environment again
- If the server needs to be stopped, press `Ctrl+C` in the Terminal window where it's running
## Suggested Dev Notes

> [!NOTE]
> If you would like to contribute any changes related to improved configuration and installation, read further.

- For future developments, shifting to `uv` package management may be more helpful for dependency management. At the moment, using `uv` does not work in conducting this installation which is why the default `pip` is currently being used.

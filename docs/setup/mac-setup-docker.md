# About

__Implemented by [Adryan Eka Vandra](https://github.com/adryanev) (Indonesia)__

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
brew install wget openssl ffmpeg make cmake python docker bento4 uv
```
This command also installs Docker. Ensure Docker is started before proceeding. For Mac, installing `docker` via Homebrew typically includes Docker Desktop, which you'll need to run.

> [!NOTE]
> The `uv` package manager is installed via Homebrew in the previous step. It will be used to manage Python dependencies and virtual environments for the Cinemata project. This is a faster alternative to `pip` and provides better dependency resolution.


3. ### Prepare for Dockerized Services
PostgreSQL and Redis will be run as Docker containers using Docker Compose. The configuration file (`docker-compose.dev.yml`) is located within the `cinematacms` repository, which you will clone in the next section.

4. ### Create your working directory
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

2. ### Start Background Services with Docker Compose
Now that you have cloned the `cinematacms` repository and are inside the `cinematacms` directory, start the PostgreSQL and Redis services using the Makefile:

```zsh
make docker-up
```
This command utilizes the `Makefile` target `docker-up`, which in turn runs `docker-compose -f docker-compose.dev.yml up -d`. This will:
- Pull the required Docker images for all services defined in `docker-compose.dev.yml` (including PostgreSQL and Redis) if they are not already present.
- Start these service containers in detached mode (`-d`).
- The PostgreSQL database named `mediacms` with user `mediacms` and password `mediacms` will be automatically created as defined in the `docker-compose.dev.yml` file.

You can check if the containers are running with `docker ps`.

3. ### Create environment files
Go back to the `/cinematacms` folder (if you navigated away, e.g., into `whisper.cpp`) and create an `.env` file by copying the example file:

```zsh
cd ~/Desktop/cinemata/cinematacms # Ensure you are in the correct directory
cp .env.example .env
```

4. ### Prepare Python Environment
The `cinematacms` project requires Python 3.10. `uv`, which you'll use in the next step, will create and manage a Python virtual environment for the project using an available Python 3.10 interpreter.

Ensure you have Python 3.10 installed on your system and accessible in your PATH. `uv` will use this version to create the virtual environment. If Python 3.10 is not installed, you can install it using various methods, for example, directly from [python.org](https://www.python.org/downloads/) or via Homebrew (`brew install python@3.10`).

After ensuring Python 3.10 is available, navigate into the `cinematacms` project directory to continue:

```zsh
# Navigate into the cinematacms project directory
cd ~/Desktop/cinemata/cinematacms
```

The virtual environment itself will be created by `uv` in the next step. You won't need to manually create or activate it for the `make` targets provided in this guide.

5. ### Install Python packages and Create Virtual Environment
Ensuring you are in the `cinematacms` directory (after setting the `pyenv local` version), install the required Python packages using the Makefile command. This step will also automatically create a virtual environment (typically named `.venv` in the `cinematacms` directory) if one doesn't already exist, using the Python 3.10 version set previously.

```zsh
make sync
```
This command uses the `sync` target in the `Makefile`, which executes `uv sync`. `uv sync` installs or updates Python packages based on the project's dependency configuration (e.g., `pyproject.toml` or `requirements.txt` if configured for `uv`). After this, subsequent `uv run` commands or `make` targets that use `uv run` (like `make dev-server`) will automatically use this managed environment.

6. ### Generate a secret key
Generate a secret key for Django:

```zsh
uv run python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Copy the output (this is your secret key)

7. ### Set up environment files
Open the `.env` file in a text editor (it was just copied from `.env.example`):

```zsh
open -a TextEdit .env
```

The file will contain pre-filled values from the example. Locate the `SECRET_KEY` variable and update its value, replacing `YOUR_SECRET_KEY_HERE` (or the existing placeholder in `.env.example`) with the key you generated:

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
SSL_FRONTEND_HOST=FRONTEND_HOST.replace('http', 'http')
SECRET_KEY=os.getenv('SECRET_KEY')
LOCAL_INSTALL=True
DEBUG = True
STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, "static")]
STATIC_ROOT = os.path.join(BASE_DIR, 'static_collected')

# Whisper CPP directory
WHISPER_CPP_COMMAND = "/Users/YOUR_USERNAME/Desktop/cinemata/whisper.cpp/main"
WHISPER_CPP_MODEL = "/Users/YOUR_USERNAME/Desktop/cinemata/whisper.cpp/models/large-v3.bin"

# Explicitly set Redis as broker
REDIS_LOCATION = "redis://127.0.0.1:6379/1"
BROKER_URL = REDIS_LOCATION
CELERY_RESULT_BACKEND = BROKER_URL

MP4HLS_COMMAND = (
    "/opt/homebrew/bin/mp4hls"
)
```

Change the path accordingly, save and close the file.

8. ### Set up database and static files
Go back to the `/cinematacms` directory and create necessary folders and run the Django management commands:

```zsh
cd ..
mkdir logs
mkdir pids

uv run python manage.py makemigrations files users actions
uv run python manage.py migrate
uv run python manage.py loaddata fixtures/encoding_profiles.json
uv run python manage.py loaddata fixtures/categories.json
uv run python manage.py collectstatic --noinput
```

9. ### Create an admin user
Create an admin user with a random password:

```zsh
ADMIN_PASS=$(uv run python -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))")
echo "from users.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASS')" | uv run python manage.py shell
echo "Your admin password is $ADMIN_PASS"
```

Write down the admin password that's displayed as this will let you access the Django admin panel.

10. ### Start the server
Finally, start the Django development server using the Makefile command. This will run the server within the `uv`-managed environment:

```zsh
make dev-server
```

You should now be able to access Cinemata at http://127.0.0.1:8000 in your browser. To log in as admin, use:

- Username: admin
- Password: (the ADMIN_PASS that was displayed earlier)

## Running Celery Workers

Once the main development server is running, you may also need to start the Celery workers for background task processing, such as video encoding, notifications, and speech-to-text transcription. These workers handle different types of tasks.

Open new terminal windows or tabs for each Celery service you want to run. Navigate to the `cinematacms` project directory (`~/Desktop/cinemata/cinematacms`) in each terminal before running the commands.

- **Celery Beat (Scheduler):** Responsible for scheduling periodic tasks.
  ```zsh
  make celery-beat-start
  ```

- **Celery Worker for Short Tasks:** Handles quick, short-duration background tasks.
  ```zsh
  make celery-short-start
  ```

- **Celery Worker for Long Tasks:** Manages time-consuming background tasks like video processing.
  ```zsh
  make celery-long-start
  ```

- **Celery Worker for Whisper Tasks:** Specifically for handling speech-to-text transcription using Whisper.
  ```zsh
  make celery-whisper-start
  ```

Alternatively, you can start all Celery services (beat, long, short, and whisper workers) with a single command. However, you will not see individual logs for each service in the same way as starting them separately.
  ```zsh
  make celery-start-all
  ```

To check the status of Celery processes, you can use:
  ```zsh
  make celery-status
  ```

Refer to the [Makefile and uv Usage Guide](./makefile-and-uv.md) for more Celery-related commands, including how to stop and restart workers.

## Frontend Development

This guide has covered the backend setup for Cinemata.
If you also plan to work on the frontend, which uses Node.js, React, and webpack, please refer to the dedicated frontend development guide for setup and build instructions:

[Frontend Development Guide](./frontend-development.md)

## Troubleshooting
(This section is intentionally left blank for now, as Docker setup simplifies many common issues. If you encounter Docker-specific problems, refer to Docker documentation or community forums.)

## Additional Tips
- The `make` targets in this guide (like `make sync` and `make dev-server`) use `uv run`, which automatically manages the virtual environment. You typically do **not** need to manually activate the virtual environment when using these `make` commands.
- If you wish to run Python commands directly (e.g., `python manage.py <command>`, `pip list` within the project's environment) outside of the `make` targets, you'll need to activate the virtual environment first. `uv` creates it inside the `cinematacms` directory, usually as `.venv`.
  To activate it:
  ```zsh
  cd ~/Desktop/cinemata/cinematacms  # If not already there
  source .venv/bin/activate
  ```
- Once activated, your terminal prompt often changes (e.g., showing `(.venv)`).
- To deactivate the virtual environment, type `deactivate` in the Terminal.
- If you close your Terminal and come back later to work directly with project commands (not via `make`), you'll need to re-activate the virtual environment.

## Makefile and `uv` Usage

The Cinemata CMS project utilizes a `Makefile` for common development tasks and `uv` for Python package and virtual environment management. These tools streamline the setup and development workflow.

For a detailed guide on the available `make` commands (including Docker operations, development server, and Celery task management) and how `uv` is integrated for dependency management, please refer to the following document:

[Makefile and uv Usage Guide](./makefile-and-uv.md)

## Suggested Dev Notes

> [!NOTE]
> If you would like to contribute any changes related to improved configuration and installation, read further.

# Makefile and uv Usage Guide

This document provides information about the Makefile commands available in Cinemata CMS and how to use uv for Python dependency management.

## Makefile Commands

The Cinemata CMS project includes a Makefile with various commands to help with development and container management. Below is a list of available commands:

### Docker-related Commands

| Command | Description |
|---------|-------------|
| `make docker-up` | Start all services defined in docker-compose.dev.yml |
| `make docker-down` | Stop all services |
| `make docker-restart` | Restart all services |
| `make docker-logs` | View logs from all services |
| `make docker-ps` | List running services |
| `make docker-clean` | Remove volumes and containers |
| `make docker-build` | Build or rebuild services |
| `make docker-shell-db` | Open a shell in the database container |
| `make docker-shell-redis` | Open a shell in the redis container |

### Development Commands

| Command | Description |
|---------|-------------|
| `make sync` | Sync Python dependencies using uv |
| `make dev-server` | Start the Django development server |

### Celery Commands

| Command | Description |
|---------|-------------|
| `make celery-beat-start` | Start Celery beat scheduler |
| `make celery-beat-stop` | Stop Celery beat scheduler |
| `make celery-beat-restart` | Restart Celery beat scheduler |
| `make celery-long-start` | Start long tasks worker |
| `make celery-long-stop` | Stop long tasks worker |
| `make celery-long-restart` | Restart long tasks worker |
| `make celery-short-start` | Start short tasks worker |
| `make celery-short-stop` | Stop short tasks worker |
| `make celery-short-restart` | Restart short tasks worker |
| `make celery-whisper-start` | Start whisper tasks worker |
| `make celery-whisper-stop` | Stop whisper tasks worker |
| `make celery-whisper-restart` | Restart whisper tasks worker |
| `make celery-start-all` | Start all Celery services |
| `make celery-stop-all` | Stop all Celery services |
| `make celery-restart-all` | Restart all Celery services |
| `make celery-status` | Show Celery process status |

## Using uv for Dependency Management

[uv](https://github.com/astral-sh/uv) is a Python package installer and resolver that's designed to be fast and reliable. Cinemata CMS integrates uv for dependency management.

### Key Features of uv

- Fast package installation and dependency resolution
- Compatible with pip's command-line interface
- Support for lockfiles to ensure reproducible builds
- Built-in virtual environment management

### Commands

The project includes these uv-related commands in the Makefile:

```bash
# Sync all dependencies using uv
make sync

# Run the development server using uv's Python interpreter
make dev-server
```

### Manual uv Usage

You can also use uv directly:

```bash
# Run python file
uv run manage.py

# Install all dependencies from requirements.txt
uv pip sync requirements.txt

# Create a new virtual environment
uv venv

# Run a Python command using uv
uv run python <script.py>
```

## Getting Started with Development

For a typical development workflow:

1. Clone the repository
2. Use Docker with `make docker-up` to start all services
3. Run `make sync` to install all dependencies
4. Run `make dev-server` to start the Django development server

## Additional Resources

- [uv Documentation](https://github.com/astral-sh/uv)
- [Django Development Server Documentation](https://docs.djangoproject.com/en/5.2/ref/django-admin/#runserver)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

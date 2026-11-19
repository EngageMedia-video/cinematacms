---
status: proposed
---

# The Python interpreter comes from uv, not the operating system

Cinemata runs on Python 3.14. Ubuntu 22.04 only ships Python 3.10, which stopped receiving security fixes in October 2026. Servers stay on Ubuntu 22.04 and build the application virtualenv from a uv-managed CPython (`uv python install`). The system `python3` remains on the server for operating-system tools and the observability exporters, but the application never runs on it. Each interpreter gets its own versioned virtualenv under `/home/cinemata/venvs/`. The systemd units and the deploy scripts reach the active one only through the `/home/cinemata/venv` link, so moving to another interpreter, or back, means changing the link and restarting the services.

## Considered Options

- **Move to Ubuntu 24.04 and use its Python 3.12.** This ties the Python version to the OS release. It also forces a re-check of ffmpeg and the observability stack in the same change, and 3.12 support ends two years before 3.14 support.
- **Install Python from the deadsnakes PPA.** This is a third-party apt source with no guaranteed builds for future Ubuntu releases, and it still ties the upgrade to `apt`.

## Consequences

- The OS Python and the app Python differ on purpose. Run `/home/cinemata/venv/bin/python`, not `python3`, for anything that imports Django.
- uWSGI is compiled against the uv interpreter when `requirements.txt` is installed, so each new virtualenv rebuilds it.
- Moving to a newer Ubuntu release is a separate change that does not have to move Python.

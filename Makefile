.PHONY: docker-up docker-down docker-restart docker-logs docker-ps docker-clean docker-build docker-shell-db docker-shell-redis sync help dev-server start-celery-beat stop-celery-beat start-celery-long stop-celery-long start-celery-short stop-celery-short start-celery-whisper stop-celery-whisper celery-beat-start celery-beat-stop celery-beat-restart celery-long-start celery-long-stop celery-long-restart celery-short-start celery-short-stop celery-short-restart celery-whisper-start celery-whisper-stop celery-whisper-restart celery-start-all celery-stop-all celery-restart-all celery-status

# Docker compose file to use
COMPOSE_FILE = docker-compose.dev.yml

# Makefile for CinemataCMS Celery Services

# Common variables
APP_DIR := .
CELERY_BIN := $(shell which celery)
CELERY_APP := cms
CELERYD_LOG_LEVEL := INFO
CELERYD_PID_DIR := $(APP_DIR)/pids
CELERYD_LOG_DIR := $(APP_DIR)/logs

# Ensure directories exist
$(shell mkdir -p $(CELERYD_PID_DIR) $(CELERYD_LOG_DIR))

CELERYD_PID_FILE := $(CELERYD_PID_DIR)/%n.pid
CELERYD_LOG_FILE := $(CELERYD_LOG_DIR)/%N.log

## BEAT Service
BEAT_PID_FILE := $(CELERYD_PID_DIR)/beat.pid
BEAT_LOG_FILE := $(CELERYD_LOG_DIR)/beat.log

help:
	@echo "Cinemata CMS - Docker Development Commands"
	@echo ""
	@echo "Usage:"
	@echo "  make docker-up        - Start all services"
	@echo "  make docker-down      - Stop all services"
	@echo "  make docker-restart   - Restart all services"
	@echo "  make docker-logs      - View logs from all services"
	@echo "  make docker-ps        - List running services"
	@echo "  make docker-clean     - Remove volumes and containers"
	@echo "  make docker-build     - Build or rebuild services"
	@echo "  make docker-shell-db  - Open a shell in the database container"
	@echo "  make docker-shell-redis - Open a shell in the redis container"
	@echo "  make sync          - Sync Python dependencies using uv"
	@echo "  make dev-server    - Start the development server"
	@echo ""
	@echo "Celery Commands:"
	@echo "  make celery-beat-start    - Start Celery beat scheduler"
	@echo "  make celery-beat-stop     - Stop Celery beat scheduler"
	@echo "  make celery-long-start    - Start long tasks worker"
	@echo "  make celery-long-stop     - Stop long tasks worker"
	@echo "  make celery-short-start   - Start short tasks workers"
	@echo "  make celery-short-stop    - Stop short tasks workers"
	@echo "  make celery-whisper-start - Start whisper tasks worker"
	@echo "  make celery-whisper-stop  - Stop whisper tasks worker"
	@echo "  make celery-start-all     - Start all Celery services"
	@echo "  make celery-stop-all      - Stop all Celery services"
	@echo "  make celery-status        - Show Celery process status"

docker-up:
	docker compose -f $(COMPOSE_FILE) up -d

docker-down:
	docker compose -f $(COMPOSE_FILE) down

docker-restart:
	docker compose -f $(COMPOSE_FILE) restart

docker-logs:
	docker compose -f $(COMPOSE_FILE) logs -f

docker-ps:
	docker compose -f $(COMPOSE_FILE) ps

docker-clean:
	docker compose -f $(COMPOSE_FILE) down -v --remove-orphans

docker-build:
	docker compose -f $(COMPOSE_FILE) build

docker-shell-db:
	docker compose -f $(COMPOSE_FILE) exec db sh

docker-shell-redis:
	docker compose -f $(COMPOSE_FILE) exec redis sh

sync:
	@echo "Syncing Python dependencies using uv..."
	uv sync

dev-server:
	uv run manage.py runserver

## BEAT Service
celery-beat-start:
	$(CELERY_BIN) beat \
		-A $(CELERY_APP) \
		--pidfile=$(BEAT_PID_FILE) \
		--logfile=$(BEAT_LOG_FILE) \
		--loglevel=$(CELERYD_LOG_LEVEL) \
		--workdir=$(APP_DIR)

celery-beat-stop:
	@if [ -f $(BEAT_PID_FILE) ]; then \
		kill -TERM $$(cat $(BEAT_PID_FILE)) || true; \
		rm -f $(BEAT_PID_FILE); \
	else \
		echo "Beat PID file not found"; \
	fi

celery-beat-restart: celery-beat-stop celery-beat-start

## LONG Tasks Worker
LONG_NODES := long1
LONG_QUEUE := long_tasks
LONG_OPTS := -Ofair --prefetch-multiplier=1

celery-long-start:
	$(CELERY_BIN) worker \
		-A $(CELERY_APP) \
		--pidfile=$(CELERYD_PID_DIR)/long.pid \
		--logfile=$(CELERYD_LOG_DIR)/long.log \
		--loglevel=$(CELERYD_LOG_LEVEL) \
		$(LONG_OPTS) \
		--workdir=$(APP_DIR) \
		-Q $(LONG_QUEUE) \
		-n long@%h

celery-long-stop:
	@if [ -f $(CELERYD_PID_DIR)/long.pid ]; then \
		kill -TERM $$(cat $(CELERYD_PID_DIR)/long.pid) || true; \
		rm -f $(CELERYD_PID_DIR)/long.pid; \
	else \
		echo "Long worker PID file not found"; \
	fi

celery-long-restart: celery-long-stop celery-long-start

## SHORT Tasks Worker
SHORT_NODES := short1 short2
SHORT_QUEUE := short_tasks
SHORT_OPTS := --soft-time-limit=300 -c10

celery-short-start:
	$(CELERY_BIN) worker \
		-A $(CELERY_APP) \
		--pidfile=$(CELERYD_PID_DIR)/short.pid \
		--logfile=$(CELERYD_LOG_DIR)/short.log \
		--loglevel=$(CELERYD_LOG_LEVEL) \
		$(SHORT_OPTS) \
		--workdir=$(APP_DIR) \
		-Q $(SHORT_QUEUE) \
		-n short@%h

celery-short-stop:
	@if [ -f $(CELERYD_PID_DIR)/short.pid ]; then \
		kill -TERM $$(cat $(CELERYD_PID_DIR)/short.pid) || true; \
		rm -f $(CELERYD_PID_DIR)/short.pid; \
	else \
		echo "Short worker PID file not found"; \
	fi

celery-short-restart: celery-short-stop celery-short-start

## WHISPER Tasks Worker
WHISPER_NODES := whisper1
WHISPER_QUEUE := whisper_tasks
WHISPER_OPTS := -Ofair --prefetch-multiplier=1

celery-whisper-start:
	$(CELERY_BIN) worker \
		-A $(CELERY_APP) \
		--pidfile=$(CELERYD_PID_DIR)/whisper.pid \
		--logfile=$(CELERYD_LOG_DIR)/whisper.log \
		--loglevel=$(CELERYD_LOG_LEVEL) \
		$(WHISPER_OPTS) \
		--workdir=$(APP_DIR) \
		-Q $(WHISPER_QUEUE) \
		-n whisper@%h

celery-whisper-stop:
	@if [ -f $(CELERYD_PID_DIR)/whisper.pid ]; then \
		kill -TERM $$(cat $(CELERYD_PID_DIR)/whisper.pid) || true; \
		rm -f $(CELERYD_PID_DIR)/whisper.pid; \
	else \
		echo "Whisper worker PID file not found"; \
	fi

celery-whisper-restart: celery-whisper-stop celery-whisper-start

## Combined Commands
celery-start-all: celery-beat-start celery-long-start celery-short-start celery-whisper-start

celery-stop-all: celery-beat-stop celery-long-stop celery-short-stop celery-whisper-stop

celery-restart-all: celery-stop-all celery-start-all

celery-status:
	ps aux | grep '[c]elery' || echo "No celery processes running"
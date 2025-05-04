.PHONY: docker-up docker-down docker-restart docker-logs docker-ps docker-clean docker-build docker-shell-db docker-shell-redis sync help dev-server

# Docker compose file to use
COMPOSE_FILE = docker-compose.dev.yml

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
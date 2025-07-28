
# Standard values
PROJECT_NAME 	= transcendence
DOCKER_COMPOSE = ./docker-compose.yml
HOST_URL        = transcendence.42.fr

all: $(PROJECT_NAME)

$(PROJECT_NAME): build

create_hostname:
	@if [ -f /etc/hosts ] && grep -q "$(HOST_URL)"  /etc/hosts; then \
		echo " Hostname already exists."; \
	else \
		echo "127.0.0.1 $(HOST_URL)" | tee -a /etc/hosts > /dev/null; \
		echo " Hostname created successfully!"; \
	fi

# Commands
build: create_hostname
	@echo "🚀 Building $(PROJECT_NAME)..."
	@docker compose -p $(PROJECT_NAME) -f $(DOCKER_COMPOSE) up --scale gateway-api=3 --build || (echo " 🚨 Build failed!"; exit 1)

start:
	@echo "▶️ Starting $(PROJECT_NAME)..."
	@docker compose -p $(PROJECT_NAME) -f $(DOCKER_COMPOSE) up --scale gateway-api=3 -d

stop:
	@echo "⏹️ Stopping $(PROJECT_NAME)..."
	@docker compose -f $(DOCKER_COMPOSE) stop
	
clean:
	@echo "🧹 Stopping and removing containers..."
	@docker compose -f $(DOCKER_COMPOSE) down -v

# Clean volumes, networks and unsed data
fclean: clean
	@echo "🔥 Full clean: removing volumes, images, and networks..."
	@docker compose -f $(DOCKER_COMPOSE) down --volumes --rmi all --remove-orphans
	@rm -rf secrets blockchain database

prepare:
	@echo "\nPrepare to start with a clean environment..."
	@echo "\nStop containers"
	@docker stop $$(docker ps -qa) > $(HIDE) || true

	@echo "\nRemove containers"
	@docker rm $$(docker ps -qa) > $(HIDE) || true

	@echo "\nRemove images"
	@docker rmi -f $$(docker images -qa) > $(HIDE) || true

	@echo "\nRemove Volumes"
	@docker volume rm $$(docker volume ls -q) > $(HIDE) || true

	@echo "\nRemove Network"
	@docker network rm $$(docker network ls -q) > $(HIDE) || true
	@echo ""


re: fclean build

# Custom Values

HIDE = /dev/null 2>&1

.PHONY: build clean prepare create_hostname start stop fclean re

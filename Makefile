COMPOSE := docker compose -f srcs/docker-compose.yml
FLAGS   := --remove-orphans

# Project and volume names
PROJECT_NAME   := srcs

# 1. Frontend Build Artifacts (Safe to delete, just re-builds next time)
FRONTEND_CACHE_VOLUMES := \
	$(PROJECT_NAME)_frontend_nuxt_hidden \
	$(PROJECT_NAME)_frontend_output_hidden

# 2. Dependency Volumes (Safe to delete, just re-installs next time)
MODULE_VOLUMES := \
	$(PROJECT_NAME)_frontend_node_modules \
	$(PROJECT_NAME)_auth_node_modules

# Tear down first so volumes are not still mounted by running containers.
all: getuser
	$(COMPOSE) down $(FLAGS)
	@$(MAKE) cleanv
	@$(MAKE) up

getuser:
	@touch srcs/.env
	@grep -q '^UID=' srcs/.env && sed -i.bak "s/^UID=.*/UID=$$(id -u)/" srcs/.env && rm -f srcs/.env.bak || echo "UID=$$(id -u)" >> srcs/.env
	@grep -q '^GID=' srcs/.env && sed -i.bak "s/^GID=.*/GID=$$(id -g)/" srcs/.env && rm -f srcs/.env.bak || echo "GID=$$(id -g)" >> srcs/.env

up: getuser
	$(COMPOSE) up -d --build $(FLAGS)

live: getuser
	$(COMPOSE) up --build

down: getuser
	$(COMPOSE) down $(FLAGS)
	@$(MAKE) cleanv

clean: getuser
	$(COMPOSE) down --rmi all $(FLAGS)
	@$(MAKE) cleanv

# Removes all artifacts and dev containers, does not remove the notes databases
cleanv: 
	@echo "Removing only node_modules volumes..."
	-docker volume rm $(MODULE_VOLUMES)
	@echo "Cleaning frontend build cache..."
	-docker volume rm $(FRONTEND_CACHE_VOLUMES)
	@docker image prune -f

# Destructive: will destroy databases, both notes and users
fclean: getuser
	@echo "Removing all volumes..."
	$(COMPOSE) down -v --rmi all $(FLAGS)	

re: clean up

logs: getuser
	$(COMPOSE) logs -f $(service)

.PHONY: all up down clean cleanv fclean clean_pnpm_volumes re logs

# Docker commands
# docker volume rm $(docker volume ls -q)

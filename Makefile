COMPOSE := docker compose -f srcs/docker-compose.yml
FLAGS   := --remove-orphans

# Project and volume names
PROJECT_NAME   := srcs

# 1. Frontend Build Artifacts (Safe to delete, just re-builds next time)
FRONTEND_CACHE_VOLUMES := \
	$(PROJECT_NAME)_frontend_nuxt_hidden \
	$(PROJECT_NAME)_frontend_output_hidden

# 2. Dependency Volumes (Safe to delete, just re-installs next time)
# Note: srcs_frontend_manual_node_modules is kept for backward compat if needed
MODULE_VOLUMES := \
	$(PROJECT_NAME)_frontend_node_modules \
	$(PROJECT_NAME)_frontend_manual_node_modules \
	$(PROJECT_NAME)_auth_node_modules

all: up

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

clean: getuser 
	$(COMPOSE) down --rmi all $(FLAGS)

fclean: getuser
	@echo "Removing all volumes..."
	$(COMPOSE) down -v --rmi all $(FLAGS)	

# In case of dependency changes! Adjust MODULE_VOLUMES. Run Manually after clean
clean_volumes:
# 	docker volume ls -q | grep -v 'srcs_postgres_data' | xargs docker volume rm || true
	@echo "Removing only node_modules volumes..."
	-docker volume rm $(MODULE_VOLUMES)

# Removes only Nuxt/Vite build artifacts
clean_frontend:
	@echo "Cleaning frontend build cache..."
	-docker volume rm $(FRONTEND_CACHE_VOLUMES)

cleanv: clean clean_volumes clean_frontend

re: clean all

logs: getuser
	$(COMPOSE) logs -f $(service)

.PHONY: all up down clean cleanv fclean clean_volumes re logs

# Docker commands
# docker volume rm $(docker volume ls -q)

COMPOSE := docker compose -f srcs/docker-compose.yml

FLAGS   := --remove-orphans

# Project and volume names
PROJECT_NAME   := srcs

# Frontend Build Artifacts (Safe to delete, just re-builds next time)
FRONTEND_CACHE_VOLUMES := \
	$(PROJECT_NAME)_frontend_nuxt_hidden \
	$(PROJECT_NAME)_frontend_output_hidden

# Dependency Volumes (Safe to delete, just re-installs next time)
MODULE_VOLUMES := \
	$(PROJECT_NAME)_frontend_node_modules \
	$(PROJECT_NAME)_auth_node_modules

# Tear down first so volumes are not still mounted by running containers.
all: getuser
	$(COMPOSE) down $(FLAGS)
	@$(MAKE) up

getuser:
# 	@touch srcs/.env
# 	@grep -q '^UID=' srcs/.env && sed -i.bak "s/^UID=.*/UID=$$(id -u)/" srcs/.env && rm -f srcs/.env.bak || echo "UID=$$(id -u)" >> srcs/.env
# 	@grep -q '^GID=' srcs/.env && sed -i.bak "s/^GID=.*/GID=$$(id -g)/" srcs/.env && rm -f srcs/.env.bak || echo "GID=$$(id -g)" >> srcs/.env

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
	@-docker volume rm $(MODULE_VOLUMES) 2>/dev/null
	@echo "Cleaning frontend build cache..."
	@-docker volume rm $(FRONTEND_CACHE_VOLUMES) 2>/dev/null
	@docker image prune -f
	docker volume ls --filter "label=com.docker.compose.project=mycelium" -q | xargs docker volume rm    

# Destructive: will destroy databases, both notes and users
fclean: getuser
	@echo "Removing all volumes..."
	$(COMPOSE) down -v --rmi all $(FLAGS)

# Nuclear: removes all volumes ever created by this project (any naming scheme)
wipe: fclean
	@echo "Removing orphaned project volumes..."
	@docker volume ls -q | grep -E '^(srcs_|mycelium_|db$$)' | xargs docker volume rm 2>/dev/null; true
	@echo "Done."

re: clean up

dev: getuser
	docker compose -f srcs/docker-compose-dev.yml up -d --build $(FLAGS)

# ex: make rebuild service=frontend
rebuild: getuser
	$(COMPOSE) up -d --build --no-deps $(service)

logs: getuser
	$(COMPOSE) logs -f $(service)

getlogs: 
	$(COMPOSE) logs > all-docker-logs-$(shell date +%Y-%m-%d_%H-%M-%S).txt 2>&1
	
.PHONY: all up down clean cleanv fclean wipe clean_pnpm_volumes re logs

# Potential volume cleanup to remove everything except data volumes:
# docker volume ls -q | grep -v 'mycelium_db' | grep -v 'mycelium_vector' | grep -v 'mycelium_grafana' | grep -v 'mycelium_prometheus' | xargs -I {} docker volume rm {}

#  # docker volume ls --filter "label=com.docker.compose.project=mycelium" -q | xargs docker volume rm      

## @docker volume ls -q | grep -E '^(srcs_|mycelium_|db$$)' | xargs docker volume rm 2>/dev/null; true


COMPOSE := docker compose -f srcs/docker-compose.yml
FLAGS   := --remove-orphans
MODULE_VOLUMES := srcs_auth_node_modules
srcs_frontend_manual_node_modules \
srcs_frontend_node_modules \
srcs_frontend_nuxt_hidden \
srcs_frontend_output_hidden 
# srcs_frontend_node_modules srcs_auth_node_modules

# All named volumes we want to purge on fclean or specific command
PROJECT_NAME   := srcs
VOLUMES_LIST   := \
	$(PROJECT_NAME)_frontend_nuxt_hidden \
	$(PROJECT_NAME)_frontend_output_hidden \
	$(PROJECT_NAME)_frontend_node_modules \
	$(PROJECT_NAME)_frontend_manual_node_modules \
	$(PROJECT_NAME)_auth_node_modules \
	$(PROJECT_NAME)_postgres_data

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

re: fclean all

# Removes all compiled data, node_modules, and database
fclean: clean
	@echo "Removing all data volumes..."
	@docker volume rm $(VOLUMES_LIST) 2>/dev/null || true
	# Alternatively: $(COMPOSE) down -v

# Only removes the frontend cache/build volumes (safe for DB)
clean-frontend:
	@echo "Cleaning frontend build artifacts..."
	@docker volume rm $(PROJECT_NAME)_frontend_nuxt_hidden $(PROJECT_NAME)_frontend_output_hidden 2>/dev/null || true
	@echo "Done."

	$(COMPOSE) down -v --rmi all $(FLAGS)	

# In case of dependency changes! Adjust MODULE_VOLUMES. Run Manually after clean
clean_volumes:
# 	docker volume ls -q | grep -v 'srcs_postgres_data' | xargs docker volume rm || true
	@echo "Removing only node_modules volumes..."
	-docker volume rm $(MODULE_VOLUMES)
cleanv: clean clean_volumes

re: clean all

logs: getuser
	$(COMPOSE) logs -f $(service)

.PHONY: all up down clean cleanv fclean clean_volumes re logs

# Docker commands
# docker volume rm $(docker volume ls -q)

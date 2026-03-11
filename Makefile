COMPOSE := docker compose -f srcs/docker-compose.yml
FLAGS   := --remove-orphans
MODULE_VOLUMES := srcs_frontend_node_modules_nuxt 
# srcs_frontend_node_modules srcs_auth_node_modules

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
	@echo "Removing only node_modules volumes..."
	-docker volume rm $(MODULE_VOLUMES)
cleanv: clean clean_volumes

re: clean all

logs: getuser
	$(COMPOSE) logs -f $(service)

.PHONY: all up down clean cleanv fclean clean_volumes re logs

# Docker commands
# docker volume rm $(docker volume ls -q)

COMPOSE := docker compose -f srcs/docker-compose.yml
FLAGS   := --remove-orphans

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

re: clean all

logs: getuser
	$(COMPOSE) logs -f $(service)

.PHONY: all up down clean re logs

# Docker commands
# docker volume rm $(docker volume ls -q)

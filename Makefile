COMPOSE := docker compose -f srcs/docker-compose.yml
FLAGS   := --remove-orphans

all: up

getUid:
	@touch srcs/.env
	@grep -q '^UID=' srcs/.env && sed -i.bak "s/^UID=.*/UID=$$(id -u)/" srcs/.env && rm -f srcs/.env.bak || echo "UID=$$(id -u)" >> srcs/.env
	@grep -q '^GID=' srcs/.env && sed -i.bak "s/^GID=.*/GID=$$(id -g)/" srcs/.env && rm -f srcs/.env.bak || echo "GID=$$(id -g)" >> srcs/.env

up: getUid
	$(COMPOSE) up -d --build $(FLAGS)

live: getUid
	$(COMPOSE) up --build


down:
	$(COMPOSE) down $(FLAGS)

clean:
	$(COMPOSE) down -v --rmi all $(FLAGS)

re: clean all

logs:
	$(COMPOSE) logs -f $(service)

.PHONY: all up down clean re logs

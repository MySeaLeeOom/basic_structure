COMPOSE := docker compose -f srcs/docker-compose.yml

all: up

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

clean:
	$(COMPOSE) down -v --rmi all

re: clean all

logs:
	$(COMPOSE) logs -f $(service)

.PHONY: all up down clean re

COMPOSE = docker compose -f srcs/docker-compose.yml

all: up

up:
	$(COMPOSE) up --build

down:
	$(COMPOSE) down

clean:
	$(COMPOSE) down -v --rmi all

re: clean all

.PHONY: all up down clean re

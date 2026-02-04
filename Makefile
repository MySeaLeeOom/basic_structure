COMPOSE := docker compose -f srcs/docker-compose.yml
FLAGS   := --remove-orphans

all: up

up:
	$(COMPOSE) up -d --build $(FLAGS)

# logs:
# 	$(COMPOSE) up --build


down:
	$(COMPOSE) down $(FLAGS)

clean:
	$(COMPOSE) down -v --rmi all $(FLAGS)

re: clean all

logs:
	$(COMPOSE) logs -f $(service)

.PHONY: all up down clean re logs

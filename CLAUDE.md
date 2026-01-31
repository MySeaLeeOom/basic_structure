# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
make up      # Build and start all services (docker compose up -d --build)
make down    # Stop services
make clean   # Stop and remove volumes + images
make re      # Clean rebuild (make clean && make up)
```

Services are accessible at `http://localhost:8080` after `make up`.

## Environment Setup

Copy `srcs/.env.example` to `srcs/.env` and set database credentials:
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## Architecture

Microservices architecture orchestrated via Docker Compose (`srcs/docker-compose.yml`).

```
Internet → nginx:8080 → /api/notes → notes:8000 (FastAPI)
                     → /           → static files
                                         ↓
                                    postgres:5432
```

### Current Services

| Service  | Tech Stack      | Port | Path        |
|----------|-----------------|------|-------------|
| nginx    | Nginx           | 8080 | / (proxy)   |
| notes    | Python/FastAPI  | 8000 | /api/notes  |
| postgres | PostgreSQL      | 5432 | (internal)  |

### Planned Services (not yet implemented)
- **auth**: Authentication service (OAuth2/local)
- **frontend**: Vue/Nuxt SPA

## Code Locations

- **Docker configs**: `srcs/requirements/[service]/Dockerfile`
- **Nginx config**: `srcs/requirements/nginx/conf/nginx.conf`
- **Notes API**: `srcs/requirements/notes/src/main.py`
- **DB schema**: `srcs/requirements/postgres/init/01-init.sql`
- **Architecture docs**: `DOCS/01_14_services_md/`

## Service Communication

- All external traffic enters through nginx (single entry point)
- Services communicate on internal Docker network `transcendence`
- Database only accessible internally (not exposed to host)

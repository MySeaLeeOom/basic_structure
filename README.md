# **Mycelium Notes**

*This project has been created as part of the 42 curriculum by [adiler], [grr-ace], [maahof], [myakoven], [pvasilan].*

# Part 1: General README

## **I. Description**

A modular open-source personal knowledge management system with built-in real-time collaboration.

## **II. Instructions**

### Prerequisites

* Docker Engine with Compose v2 (`docker compose` subcommand).
* A GitHub OAuth App for authentication (Client ID and Client Secret).
* `make` (GNU Make).

### Setup

1. **Environment variables** — Create `srcs/.env` with the following variables (the Makefile will auto-populate `UID` and `GID`):

```
DB_USER=<postgres superuser>
DB_PASSWORD=<postgres superuser password>
DB_NAME=<main database name>
AUTH_DB_USER=<auth service db user>
AUTH_DB_NAME=<auth service db name>
POSTGRES_ADDR=postgres
POSTGRES_PORT=5432
GITHUB_CLIENT_ID=<your GitHub OAuth app client ID>
GITHUB_CALLBACK_URL=http://localhost:8080/api/auth/github/callback
AUTH_PORT=3000
NOTES_ADDR=http://notes:3003
NOTES_PORT=3003
FRONTEND_ADDR=http://frontend:3000
FRONTEND_PORT=3000
WEBSITE_URL=http://localhost:8080
```

2. **Secrets** — Copy the example secrets directory and fill in real values (one value per file):

```bash
cp -r srcs/secrets.example srcs/secrets
```

The following secret files must be populated: `auth_db_password`, `github_client_secret`, `session_secret_key`, `grafana_admin_user`, `grafana_admin_password`, `todo_db_password`.

### Execution

```bash
make up        # Build all images and start in detached mode
make live      # Build and start in foreground (logs stream to terminal)
make down      # Stop all containers
make logs      # Follow logs (optionally: make logs service=auth)
make clean     # Stop containers and remove images
make cleanv    # clean + remove node_modules and frontend build cache volumes
make fclean    # Destructive: removes everything including database volumes
make re        # clean + rebuild
```

The application is accessible at `http://localhost:8080`. Grafana dashboards are at `http://localhost:3000`.

## **III. Resources**

* List documentation and tutorials used.

# Part 2: 42 Berlin defense documentation

## Team information

*(Team roster, roles, or defense-specific notes.)*

## **IV. Project management**

Explain your workflow.

* **Organization**: Describe your meeting schedule and how tasks were divided.
* **Tools**: List GitHub Issues, Trello, or Discord.

## **V. Technical stack**

Justify your major technical choices.

* **Frontend**: Vue/Nuxt (framework requirement).
* **Backend**: Axum and FastAPI (microservices architecture).
* **Database**: PostgreSQL (relational data and schema clarity).

## **VI. Database schema**

Provide a visual representation or description of your tables and their relationships.

* **Tables**: Users, Notes, Chapters, etc.
* **Relations**: e.g., one user has many notes; one note belongs to one chapter.

## **VII.Features list**

## **VIII. Modules & points**

Calculate your path to the 14-point minimum.

| Module | Category | Type | Points |
| --- | --- | --- | --- |
| Frameworks (Vue + Axum) | Web | Major | 2 |
| Microservices | DevOps | Major | 2 |
| RAG System | AI | Major | 2 |
| User Interaction (Chat/Friends) | Web | Major | 2 |
| **Total estimated** | | | **14+** |

## **IX. Individual contributions**

## **X. AI usage**
Describe exactly how you used AI for coding or brainstorming.

---

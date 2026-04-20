# **Mycelium Notes**

*This project has been created as part of the 42 curriculum by [adiler], [grmullin], [maahof], [myakoven], [pvasilan].*

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

* Nuxt 4, Vue 3, Pinia, TailwindCSS, PrimeVue official docs.
* TipTap editor docs; Yjs + y-websocket + y-protocols for CRDT sync.
* Fastify 5 docs; Drizzle ORM docs; `@fastify/oauth2`, Argon2 (`argon2` crate/lib).
* Axum, tokio, sqlx, yrs/y-sync docs (Rust services).
* PostgreSQL 16 reference; Nginx `auth_request` module; Prometheus + Grafana docs.
* GitHub/Google/42 OAuth provider docs.
* 42 Berlin Mycelium subject PDF.

# Part 2: 42 Berlin defense documentation

## Team information

Ahmed Diler - Developer

Maarten Hoff - Technical Lead, Developer

Masha Yakovenko - Product Owner, Developer

Pavlos Vasilantonakis - Project Manager

Grace Mullin - Developer

## **IV. Project management**

* **Organization**: Features were decided early. The main sync-time was a weekly in-person meeting with additional video calls between subsets of the team. Team members expressed interest in specific subject modules early and were encouraged to take ownership. The product owner was tasked with mantaining a forward momentum, the technical lead was asked to solve any ties in relation to tech and the project lead attempted to partially disengage from the everyday coding in order to keep the rest of the team motivated.

* **Tools**: 
    Github Issues for matching commits to issues
    Slack for everyday communication
    Github projects for the gratification of the Project Manager

## **V. Technical stack**

* **Frontend**: Nuxt 4 / Vue 3 with TailwindCSS, PrimeVue, and Pinia. TipTap provides the rich-text editor; Yjs and y-websocket handle real-time collaborative editing via CRDTs. Framework choice satisfies the 42 curriculum requirement.
* **Auth service** (TypeScript): Fastify 5 with Drizzle ORM. Handles OAuth (GitHub, Google, 42) and local password auth (Argon2). Session-based authentication with cookie tokens. Exposes Prometheus metrics via `prom-client`.
* **Notes service** (Rust): Axum + sqlx. CRUD API for note metadata. Chosen for low overhead on a high-frequency path.
* **Editor service** (Rust): Axum with WebSocket support + Yrs/y-sync. Persists Yjs CRDT document state to PostgreSQL. Handles real-time sync between collaborating clients.
* **Database**: PostgreSQL 16. Two logical databases in a single instance — one for auth (users, accounts, sessions), one for notes and document state. Relational model fits the structured data; UUID primary keys throughout.
* **Infrastructure**: Docker Compose orchestrates 10 services behind an Nginx reverse proxy. Nginx gates `/api/notes` and `/ws/` routes through an `auth_request` subrequest to the auth service. Prometheus scrapes all application and infrastructure targets; Grafana provides pre-provisioned dashboards. Exporters for Nginx and PostgreSQL round out observability.

## **VI. Database schema**

Two logical databases in a single PostgreSQL 16 instance.

**Auth database** (Drizzle ORM, migrations in `auth/drizzle/`):

| Table | Columns | Notes |
| --- | --- | --- |
| `users` | `id` (UUID PK), `email` (unique), `login_name` (unique, not null), `image_url`, `role` (enum: user/admin), `status` (enum: active/blocked/suspended), `created_at` | Central identity table |
| `accounts` | `id` (UUID PK), `user_id` (FK → users, cascade), `provider` (enum: github/local/google/42), `provider_account_id`, `password_hash` | Unique on (provider, provider_account_id). One user can have multiple provider accounts |
| `sessions` | `id` (UUID PK), `user_id` (FK → users, cascade), `token` (UUID, unique), `expires_at`, `user_agent`, `ip_address` | Cookie-based session tracking |

**Main database** (SQL init in `postgres/init/02-init.sql`):

| Table | Columns | Notes |
| --- | --- | --- |
| `notes` | `id` (UUID PK), `title` (varchar 255), `owner_id` (UUID), `created_at`, `updated_at` | Note metadata |
| `note_states` | `note_id` (UUID PK, FK → notes, cascade), `state_vector` (BYTEA), `last_saved_at` | Persisted Yjs CRDT state, 1:1 with `notes` |
| `share` | `id` (UUID PK), `note_id` (UUID, FK → notes, cascade), `guest_id` (UUID), `access_role` (enum `access_type`: View/Edit/Owner, default 'View'), `created_at`, `updated_at` | Note sharing; unique (note_id, guest_id) with `NULLS NOT DISTINCT` |


**Key relations**: one user → many accounts (multi-provider auth), one user → one session, one note → one note_state, one note -> many share. All foreign keys cascade on delete.

## **VII. Features list**

| Feature | Owner(s) |
| --- | --- |
| GitHub / Google / 42 OAuth login | Masha |
| Local email + password login (Argon2) | Masha |
| Session cookies + Nginx `auth_request` gating | Masha, Pavlos |
| Note CRUD REST API (Rust/Axum) | Maarten, Masha |
| Rich-text editor (TipTap) | Masha, Ahmed |
| Real-time collaborative editing (Yjs + y-websocket, Rust editor service) | Ahmed, Maarten, Masha |
| CRDT persistence to Postgres (`note_states`) | Maarten |
| Note sharing with per-guest role (View/Edit) | Maarten, Masha |
| Chat sidebar with LLM assistant (RAG over user notes) | Maarten, Ahmed |
| Vector store + ingest pipeline (pgvector, ai-ingest, ai-rag, llm-gateway) | Maarten, Ahmed |
| SSR (Nuxt server rendering) | Masha, Ahmed |
| i18n: 8 locales (en, de, es, el, tr, ru, ar, ie) | Grace |
| RTL support (Arabic) | Grace |
| Cross-browser support: Chromium, Firefox, Konqueror | Pavlos |
| Prometheus metrics on every service + Grafana dashboards | Pavlos |
| Nginx / Postgres exporters | Pavlos |
| Admin user management (roles, status: active/blocked/suspended) | Masha |
| GDPR: account export/delete | Masha, Grace |
| Docker Compose orchestration + Makefile workflow | Maarten, Pavlos |

## **VIII. Modules & points**

Calculate your path to the 14-point minimum.

| Module | Category | Type | Points | Justification |
| --- | --- | --- | --- | --- |
| Frameworks (Nuxt/Vue 3 + Axum) | Web | Major | 2 | Frontend built on Nuxt 4 / Vue 3; backend note and editor services built on Rust/Axum, not a micro-framework. |
| Microservices | DevOps | Major | 2 | 10-service Docker Compose topology: frontend, auth, notes, editor, ai-ingest, ai-rag, llm-gateway, vector-db, postgres, nginx, plus exporters — each independently deployable with its own Dockerfile. |
| Monitoring System (Prometheus + Grafana) | DevOps | Major | 2 | Every app service exposes `/metrics`; Prometheus scrapes them together with nginx-exporter and postgres-exporter; Grafana has pre-provisioned dashboards. |
| RAG System | AI | Major | 2 | `ai-ingest` chunks and embeds notes into pgvector (`vector-db`); `ai-rag` retrieves context and augments prompts sent through `llm-gateway`. |
| LLM System Interface | AI | Major | 2 | Dedicated `llm-gateway` service exposes a provider-agnostic chat API, surfaced in the UI via `ChatSidebar.vue`. |
| WebSocket communication | Web | Major | 2 | Rust `editor` service uses Axum WebSockets with y-sync to broker Yjs updates; nginx routes `/ws/` through `auth_request`. |
| Real-time collaboration | Web | Minor | 1 | Multiple users editing the same note see updates in real time via CRDT merges (Yjs). |
| Server-Side Rendering | Web | Minor | 1 | Nuxt SSR is enabled; initial HTML is rendered on the server. |
| Support for multiple languages | Accessibility | Minor | 1 | 8 locales shipped in `app/locales/`: en-UK, de-DE, es-ES, el-GR, tr-TR, ru-RU, ar, ie-IE. |
| Support for RTL | Accessibility | Minor | 1 | Arabic locale plus `dir="rtl"` handling in layout and components. |
| Support for 2 additional browsers (Firefox, Konqueror) | Accessibility | Minor | 1 | Verified functional on Chromium, Firefox and Konqueror. |
| OAuth Authentication | User Management | Minor | 1 | GitHub, Google and 42 OAuth providers implemented in the auth service. |
| ORM system | Web | Minor | 1 | Drizzle ORM used in the auth service with typed schema and migrations under `auth/drizzle/`. |
| Standard user management | User Management | Major | 2 | Registration, login, logout, profile, avatar, roles (user/admin), status (active/blocked/suspended), session management. |
| GDPR compliance | Data | Minor | 1 | Account export and full account deletion; cascade delete across accounts, sessions, notes, shares. |
| **Total** | | | **22** | Well above the 14-point minimum. |

## **IX. Individual contributions**

Frameworks/Microservices: Ahmed, Maarten, Masha

Web-Sockets: Ahmed, Maarten, Masha, Pavlos

Authentication: Masha

Frontend and SSR: Masha, Ahmed, Grace

Notes API: Maarten, Masha

Monitoring/Browser Testing: Pavlos

RAG/LLM: Maarten, Ahmed

Localization: Grace

## **X. AI usage**
Pavlos: Used AI to research the pros and cons of different stacks, for detecting code smells, for changes that needed multi-file editing to make sure all contact points were adequately worked on and for the creation of tutorials and learning material for the project
Maarten: Used AI for research, brainstorming, structure/idea validation, writing repetitive code, and double-checking documentation.
Masha: Used AI for research, writing repetetive code, assistance with learning frameworks like Fastify, tutorials, assistance with tricky styling issues, keeping track of refactors and changes that needed multifile editing, particularly for UI bugs.
Ahmet: Used AI to research unfamiliar technologies (Yjs/CRDTs, TipTap, WebSockets), coordinate multi-file changes across the frontend and backend, and draft internal dev documentation. All output was reviewed and tested before use.
Grace: Used AI to figure out how to integrate my contributions to the project and to summarise the other different services, their roles and how they interact. It was also used to debug configuration issues, in particular with Docker and Cargo.

## **Future Features**
What in-theory would be an obvious next step:

    user management with accounts
    
    extended dashboards
    
    sentiment analysis and semantic tagging
    
    friends and networks (?)
    
    backlinks

---

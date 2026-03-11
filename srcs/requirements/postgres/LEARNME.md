# Learn Postgres Initialization 🐘

This container is the **Source of Truth** for all data in our application. It is built on top of the official `postgres:16-alpine` image but includes a custom initialization process to support our microservices architecture (Auth Service + Notes Service).

---

## 1. The "Invisible" Environment Variables (Official)

When the official Postgres container starts for the first time, it looks for specific environment variables to set up the **Default Superuser and Database**. These are defined in `docker-compose.yml`.

| Variable | Purpose | Our Value (from `.env`) |
| :--- | :--- | :--- |
| `POSTGRES_USER` | The username of the **Super Admin**. | `${DB_USER}` |
| `POSTGRES_PASSWORD` | The password for the Super Admin. | `${DB_PASSWORD}` |
| `POSTGRES_DB` | The name of the default database created on startup. | `${DB_NAME}` (Used by Notes/Editor) |

**Important:** If `POSTGRES_DB` is set, the container creates that database automatically. This is why the `notes` service can connect immediately without us manually creating `transcendence_db` or similar.

---

## 2. The Custom Initialization (Our `init/` Folder)

Because we run multiple microservices (Auth, Notes, Editor), we need more than just one default database. We need a second database specifically for **Auth** to keep user credentials isolated.

### How it Works: The Magic Folder `/docker-entrypoint-initdb.d/`

The official Postgres image has a feature:
1.  On **First Startup** (when the volume is empty), it checks the folder `/docker-entrypoint-initdb.d/`.
2.  It runs every executable script (`.sh`, `.sql`) it finds there, in **alphanumeric order**.
3.  We copy our `init/` folder into this location inside the `Dockerfile`.

### Our Scripts

#### `01-init.sh` (The Auth Database Creator)
This script is written by us to create the **Auth Database** securely.

*   **Custom Variables**: It reads variables that the official image *ignores*: `AUTH_DB_USER` and `AUTH_DB_NAME`.
*   **Secrets**: It reads the password from `/run/secrets/auth_db_password` (Docker Swarm/Compose secret mount) instead of an environment variable, ensuring the password doesn't leak in logs.
*   **Action**: It uses the `psql` command-line tool (as the Super Admin) to:
    1.  Create the database `$AUTH_DB_NAME`.
    2.  Create the user `$AUTH_DB_USER`.
    3.  Grant all privileges on the database to that user.

#### `02-init.sql` (The Notes Table Logic)
This is a standard SQL dump. It runs against the *default* database (`POSTGRES_DB`).
*   It creates the `notes` table (ID, Title, Owner).
*   It creates the `note_states` table (for the collaborative editor).

---

## 3. Data Persistence (Why Init Only Runs Once)

Postgres stores its actual data in `/var/lib/postgresql/data`.
In `docker-compose.yml`, we mount a volume (`postgres_data`) to this path.

**The Golden Rule:**
> Initialization scripts (`init/`) ONLY run if the directory `/var/lib/postgresql/data` is **EMPTY**.

If you restart the container, your data is safe, and the scripts will **NOT** run again (to prevent overwriting data).

**💥 How to "Reset" the Database:**
If you change `init/01-init.sh` or `init/02-init.sql` and want to see the changes:
1.  Stop the containers: `docker compose down`
2.  **Delete the volume**: `docker volume rm srcs_postgres_data` (This wipes all data!)
3.  Restart: `docker compose up --build`

# Notes Service

REST API for note metadata, lifecycle, sharing, and collaboration. Actual content editing is handled by the `editor` service via WebSockets. Built with Rust, Axum, and PostgreSQL (sqlx).

---

## Endpoints

### Notes CRUD

| Method | Path | Purpose |
| :--- | :--- | :--- |
| **GET** | `/api/notes` | List all notes for the authenticated user. |
| **POST** | `/api/notes` | Create a new note. Accepts `{ title }`. Also initializes an empty editor state in `note_states`. |
| **GET** | `/api/notes/{id}` | Get a single note's metadata. |
| **PUT** | `/api/notes/{id}` | Update a note's title. |
| **DELETE** | `/api/notes/{id}` | Delete a note. |
| **DELETE** | `/api/notes/by-owner` | Delete all notes for the authenticated user (used by account deletion). |
| **GET** | `/api/notes/export` | Export all notes with their binary state vectors (used by GDPR export). |

### Slugs

| Method | Path | Purpose |
| :--- | :--- | :--- |
| **GET** | `/api/notes/u/{slug}` | Resolve a note by its `owner_url` slug for the authenticated user. |

### Collaboration / Sharing

| Method | Path | Purpose |
| :--- | :--- | :--- |
| **GET** | `/api/notes/collab/received` | Notes shared with the authenticated user. |
| **POST** | `/api/notes/collab/` | Create a share (guest or public link). |
| **GET** | `/api/notes/collab/access/{share_id}` | Open a shared note by share ID. |
| **GET** | `/api/notes/collab/created` | Shares created by the authenticated user. |
| **GET** | `/api/notes/collab/{note_id}` | List collaborators on a note. |
| **DELETE** | `/api/notes/collab/revoke/{share_id}` | Revoke a share. |

### Operational

| Method | Path | Purpose |
| :--- | :--- | :--- |
| **GET** | `/metrics` | Prometheus metrics (note mutation counters). |

Authentication is handled by the reverse proxy: the `X-User-Id` header (UUID) must be set by Nginx.

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DB_USER` | — | PostgreSQL username. |
| `DB_PASSWORD` | — | PostgreSQL password. |
| `DB_NAME` | — | PostgreSQL database name. |
| `DB_HOST` | `postgres` | PostgreSQL hostname. |
| `PORT` | `3003` | Port the service listens on. |

---

## Dependencies

- [axum](https://github.com/tokio-rs/axum) (HTTP framework)
- [tokio](https://tokio.rs/) (async runtime)
- [sqlx](https://github.com/launchbadge/sqlx) (PostgreSQL)
- [serde](https://serde.rs/) (serialization)
- [uuid](https://github.com/uuid-rs/uuid), [chrono](https://github.com/chronotope/chrono) (types)
- [tracing](https://github.com/tokio-rs/tracing) / [tracing-subscriber](https://docs.rs/tracing-subscriber) (structured logging)
- [fluent-bundle](https://github.com/projectfluent/fluent-rs) / [unic-langid](https://github.com/nickel-org/rust-unic-langid) (i18n)
- [prometheus](https://github.com/tikv/rust-prometheus) (metrics)

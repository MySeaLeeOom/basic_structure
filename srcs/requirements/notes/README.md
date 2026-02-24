# Notes RS Service

This service is a REST API for managing note metadata and lifecycle. Actual content editing is handled by the `editor` service via WebSockets.

## Endpoints

*   `GET /api/notes`: Retrieves all notes (metadata only).
*   `GET /api/notes/{id}`: Retrieves a single note's metadata.
*   `POST /api/notes`: Creates a new note. Requires a JSON object with a `title` field. This also initializes an empty state for the editor.
*   `PUT /api/notes/{id}`: Updates a note's title.
*   `DELETE /api/notes/{id}`: Deletes a note.

## Dependencies

*   [axum](https://github.com/tokio-rs/axum) (0.8.8)
*   [serde](https://serde.rs/) (1.0.228)
*   [sqlx](https://github.com/launchbadge/sqlx) (0.8.6)
*   [tokio](https://tokio.rs/) (1.49.0)
*   [uuid](https://github.com/uuid-rs/uuid) (1.12.1)
*   [chrono](https://github.com/chronotope/chrono) (0.4.39)

## Database

The service connects to a PostgreSQL database. The following environment variables are required for database connection:

*   `DB_USER`: The username for the database.
*   `DB_PASSWORD`: The password for the database.
*   `DB_NAME`: The name of the database.

## To be done

*   Use environment variables for configuration (ports, IP addresses).
*   Add structured logging with `tracing`.

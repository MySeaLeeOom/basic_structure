# Notes RS Service

This service is a simple REST API for creating and retrieving notes. It is written in Rust using the Axum web framework.

## Endpoints

*   `GET /api/notes`: Retrieves all notes.
*   `GET /api/note/{id}`: Retrieves a single note by its ID.
*   `POST /api/notes`: Creates a new note. Requires a JSON object with `title` and `content` fields.

## Dependencies

*   [axum](https://github.com/tokio-rs/axum) (0.8.8)
*   [serde](https://serde.rs/) (1.0.228)
*   [sqlx](https://github.com/launchbadge/sqlx) (0.8.6)
*   [tokio](https://tokio.rs/) (1.49.0)

## Database

The service connects to a PostgreSQL database. The following environment variables are required for database connection:

*   `DB_USER`: The username for the database.
*   `DB_PASSWORD`: The password for the database.
*   `DB_NAME`: The name of the database.

## To be done

*   Use environment variables for configuration (ports, IP addresses).
*   Consider using an ORM for database interaction instead of raw SQL.
*   Implement more endpoints (e.g., for editing and deleting notes).
*   Add structured logging with `tracing`.

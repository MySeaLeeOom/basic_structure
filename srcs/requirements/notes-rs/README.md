# Notes RS Service

This service is a simple REST API for creating and retrieving notes. It is written in Rust using the Axum web framework.

## Features

*   Create a new note with a title and content (POST).
*   Retrieve all existing notes (GET).

## Endpoints

*   `GET /api/notes`: get_notes()
*   `POST /api/notes`: post_note(). requires JSON object with `title` and `content` fields.

## Dependencies

*   [axum](https://github.com/tokio-rs/axum): Web framework for building the API.
*   [serde](https://serde.rs/): Framework for serializing and deserializing Rust data structures.
*   [sqlx](https://github.com/launchbadge/sqlx): Rust SQL toolkit for interacting with the PostgreSQL database.
*   [tokio](https://tokio.rs/): Asynchronous runtime for Rust.

## Database

The service connects to a PostgreSQL database. The following environment variables are required for database connection:

*   `DB_USER`: The username for the database.
*   `DB_PASSWORD`: The password for the database.
*   `DB_NAME`: The name of the database.

## To be done

*   `Makros`: Include ports, IP-adresses, and other vars in env or similar file.
*   `ORM`: For now Im talking to the db via SQL comands.
*   `End-Points`: There are a lot more end points to be written.
	*	get_note(id)
	*	delete_post(id)
	*	..
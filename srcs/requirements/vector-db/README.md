# Vector DB
PostgreSQL instance for semantic memory.

## Setup
- **Extension:** `pgvector`.
- **Database:** `vector_db`.
- **Dimension:** 1024 (optimized for `mxbai-embed-large`).

## Notes
- Uses high-precision flat search for the current scale.
- Isolated from the main application database for better resource management.

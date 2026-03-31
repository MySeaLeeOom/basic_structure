# Vector DB
Isolated PostgreSQL instance with `pgvector` extension.

## Purpose
- Stores note embeddings (vectors) and plain text content.
- Provides semantic search using HNSW indexing.
- Offloads heavy vector math from the main application database.

## Config
- Port: 5432
- Extension: `vector`
- Default Dimension: 4096 (Llama 3)

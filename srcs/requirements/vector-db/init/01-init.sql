-- The database 'vector_db' is already created by Docker via POSTGRES_DB env var.
-- This script runs automatically inside that database.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding vector(4096) -- 4096 is the dimension for Llama 3 embeddings
);

CREATE INDEX IF NOT EXISTS embedding_idx ON embeddings USING hnsw (embedding vector_cosine_ops); -- very efficient algorithm for high-dimensional vector search (O(log n))

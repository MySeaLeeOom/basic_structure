FROM pgvector/pgvector:pg16

# NOTE: EXPOSE 5432 is already written in the base image

# Custom init script to create the 'rag' database and 'pgvector' extension
COPY init/ /docker-entrypoint-initdb.d/

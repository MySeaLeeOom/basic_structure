# official postgres image, alpine = smaller size
FROM postgres:16-alpine

# copy sql scripts to postgres magic folder
# runs automatically on first container start (when data volume is empty)
COPY init/ /docker-entrypoint-initdb.d/
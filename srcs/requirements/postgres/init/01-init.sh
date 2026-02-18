#!/bin/bash

if [ -f "/run/secrets/auth_db_password"]; then
    AUTH_DB_PASSWORD=$(cat /run/secrets/auth_db_password)
fi
# Set up saparate silod using master credentials
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	-- 1. Create the Auth Silo
    CREATE DATABASE $AUTH_DB_NAME;
    CREATE USER $AUTH_DB_USER WITH ENCRYPTED PASSWORD '$AUTH_DB_PASSWORD';
    GRANT ALL PRIVILEGES ON DATABASE $AUTH_DB_NAME TO $AUTH_DB_USER;

EOSQL
    # Note: After this script runs, auth-js will connect using:
    # postgres://auth_user:auth_pass@postgres:5432/auth_db

    # -- 2. Create Notes Silo
    # CREATE DATABASE notes_db;
    # CREATE USER notes_user WITH ENCRYPTED PASSWORD 'notes_pass';
    # GRANT ALL PRIVILEGES ON DATABASE notes_db TO notes_user;





















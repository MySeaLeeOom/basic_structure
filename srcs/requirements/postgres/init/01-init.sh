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

    # -- 2. Create the Notes Silo
    # CREATE DATABASE notes_db;
    # CREATE USER notes_user WITH ENCRYPTED PASSWORD 'notes_pass';
    # GRANT ALL PRIVILEGES ON DATABASE notes_db TO notes_user;




















# # This script runs using the MASTER credentials to set up the silos
# psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
#     -- 1. Create the Auth Silo
#     CREATE DATABASE auth_db;
#     CREATE USER auth_user WITH ENCRYPTED PASSWORD 'auth_pass';
#     GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_user;

#     -- 2. Create the Notes Silo
#     CREATE DATABASE notes_db;
#     CREATE USER notes_user WITH ENCRYPTED PASSWORD 'notes_pass';
#     GRANT ALL PRIVILEGES ON DATABASE notes_db TO notes_user;
# EOSQL

# # Note: After this script runs, auth-js will connect using:
# # postgres://auth_user:auth_pass@postgres:5432/auth_db

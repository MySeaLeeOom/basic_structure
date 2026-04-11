#!/bin/bash

if [ -f "/run/secrets/auth_db_password" ]; then
    AUTH_DB_PASSWORD=$(cat /run/secrets/auth_db_password)
else
    echo "NO SECRET FOUND"
    exit 1
fi

# Create User and Database (connected to maintenance DB 'postgres')
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE $AUTH_DB_NAME;
    CREATE USER $AUTH_DB_USER WITH ENCRYPTED PASSWORD '$AUTH_DB_PASSWORD';
    GRANT ALL PRIVILEGES ON DATABASE $AUTH_DB_NAME TO $AUTH_DB_USER;
EOSQL

# Grant Schema Permissions (connected to target DB 'auth_db')
# We must switch databases to grant rights on the specific schema
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$AUTH_DB_NAME" <<-EOSQL
    GRANT ALL ON SCHEMA public TO $AUTH_DB_USER;
EOSQL
    # Note: After this script runs, auth-js will connect using:
    # postgres://auth_user:auth_pass@postgres:5432/auth_db


    # -- 2. Create Notes Silo (THIS IS ALREADY transcendence DB)
    # CREATE DATABASE notes_db;
    # CREATE USER notes_user WITH ENCRYPTED PASSWORD 'notes_pass';
    # GRANT ALL PRIVILEGES ON DATABASE notes_db TO notes_user;

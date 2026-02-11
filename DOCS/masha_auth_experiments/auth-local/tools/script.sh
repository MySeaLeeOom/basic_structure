#!/bin/bash

# Ensure Drizzle pushes the schema to your persistent SQLite file
echo "Checking database integrity..."
npx drizzle-kit push

# Execute the main process (Fastify)
# We use 'exec' so Node receives OS signals like SIGTERM (important for Docker)
echo "Launching Auth Service..."
exec npx tsx src/index.ts #== exec npm start
# previous exec node index.js for js files
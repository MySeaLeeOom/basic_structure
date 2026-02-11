# Use the official Node.js 'slim' image (Debian-based)
FROM node:20-slim

# Install OpenSSL (SQLite/Drizzle requirement)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies (Optimized for Docker caching)
COPY package*.json ./
RUN npm install

# Copy your application code
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src ./src

# Compile ts to js
RUN npx tsc

# Set up the Inception-style tool
COPY ./tools/script.sh /usr/local/bin/script.sh
RUN chmod +x /usr/local/bin/script.sh

# This directory will be linked to your /home/muni/data volume
RUN mkdir -p /app/data

EXPOSE 3001

ENTRYPOINT ["/usr/local/bin/script.sh"]
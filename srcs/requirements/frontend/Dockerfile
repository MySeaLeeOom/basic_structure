FROM node:20-slim

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# copy these 2 files first so there is no new npm install if the file has not changed
# if a change in a file occurs, docker discards every subsequent cached command from scratch
COPY package.json pnpm-lock.yaml ./

# --frozen-lockfile means the build will be consistent with what we developed 
# no new patched versions of dependencies
RUN pnpm install --frozen-lockfile

## Copy source code and build the application
## PRODUCTION ONLY
# COPY . .
# RUN pnpm run build




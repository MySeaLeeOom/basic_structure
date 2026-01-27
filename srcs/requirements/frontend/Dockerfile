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
COPY . .
RUN pnpm run build

# ==========================================
# STAGE 2: The Production Stage
# ==========================================
FROM node:20-slim AS runner

WORKDIR /app

# 5. Define Environment to ensure proper behavior
ENV NODE_ENV=production

# 6. Copy only what is necessary to RUN the app.
# We skip the source code and build tools to keep the image 'slim'.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# 7. Expose the port for your SSR server
EXPOSE 3000

# 8. Start the manual SSR server
CMD ["node", "dist/server/entry.js"]




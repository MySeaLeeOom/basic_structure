# Docker Devlog — Frontend Production Migration

**Date:** 2026-04-12
**Branch:** ui
**Scope:** `srcs/requirements/frontend/Dockerfile`, `srcs/docker-compose.yml`

---

## Why this change?

The project is moving to production. The frontend already had a `Dockerfile` separate from `Dockerfile.dev`, but it contained several bugs that would have caused the build to silently fail or the container to crash on start. The `docker-compose.yml` was also still wired to the dev setup.

---

## Dockerfile — What Changed and Why

### Before (broken)

```dockerfile
FROM node:20-slim          # Stage 1 — no name given

...
RUN pnpm run build

FROM node:20-slim AS runner   # Stage 2

COPY --from=builder /app/dist ./dist          # bug: wrong path
COPY --from=builder /app/package.json ./      # unnecessary
COPY --from=builder /app/node_modules ./node_modules  # unnecessary + huge

CMD ["node", "dist/server/entry.js"]          # bug: wrong path + wrong file
```

### After (correct)

```dockerfile
FROM node:20-slim AS builder   # Stage 1 — named

...
RUN pnpm run build

FROM node:20-slim AS runner    # Stage 2

COPY --from=builder /app/.output ./.output

CMD ["node", ".output/server/index.mjs"]
```

---

### Bug 1 — Missing `AS builder` on Stage 1

Docker multi-stage builds work by naming stages with `AS <name>` on the `FROM` line.
Stage 2 referenced `--from=builder`, but Stage 1 was declared as just `FROM node:20-slim` with no name.
Docker would reject this at build time with an error like `invalid from flag value builder: pull access denied`.

Fix: `FROM node:20-slim AS builder`

---

### Bug 2 — Wrong output directory (`dist/` vs `.output/`)

`nuxt build` (which runs Nitro under the hood) writes its output to `.output/`, not `dist/`.
- `.output/server/index.mjs` — the SSR server entry point
- `.output/public/` — static assets

The original Dockerfile was copying `./dist`, which does not exist after a Nuxt build.
The container would have started and immediately crashed because `dist/server/entry.js` does not exist.

Fix:
```dockerfile
COPY --from=builder /app/.output ./.output
CMD ["node", ".output/server/index.mjs"]
```

---

### Bug 3 — Unnecessary `node_modules` and `package.json` in Stage 2

Nuxt's `.output` directory is **self-contained**. When Nitro builds the server bundle, it traces all
dependencies and bundles them into `.output/server/node_modules/`. You do not need the project-level
`node_modules` in the runner image.

Copying `node_modules` into the runner would have:
1. Massively bloated the final image (hundreds of MB of devDependencies that serve no purpose at runtime)
2. Not actually helped, since Nitro uses its own bundled copy anyway

Fix: remove both `COPY` lines from Stage 2. The `.output` copy is all that is needed.

---

### Why multi-stage at all?

The multi-stage pattern exists to keep the final production image small and secure.

- **Stage 1 (builder):** has pnpm, all devDependencies (Vite, TypeScript, Tailwind, etc.), and the full source tree. It exists only to produce the build artefact.
- **Stage 2 (runner):** starts from a fresh `node:20-slim`, copies only `.output/`, and throws everything else away. No build tools, no source code, no devDependencies reach production.

The final image ends up being a fraction of the builder image size.

---

## docker-compose.yml — What Changed and Why

### Before

```yaml
frontend:
  build:
    context: ./requirements/frontend
    dockerfile: Dockerfile.dev        # dev dockerfile
    args:
      - UID=${UID:-1000}
      - GID=${GID:-1000}
  user: "${UID:-1000}:${GID:-1000}"
  image: frontend
  container_name: frontend
  restart: always
  volumes:
    - ./requirements/frontend:/app:z
    - frontend_node_modules:/app/node_modules
    - frontend_nuxt_hidden:/app/.nuxt
    - frontend_output_hidden:/app/.output
  networks:
    - transcendence
  environment:
    - NOTES_ADDR=${NOTES_ADDR}
    - NODE_ENV=development
    - HOME=/tmp
    - HOST=0.0.0.0
    - PORT=${AUTH_PORT}
    - NODE_TLS_REJECT_UNAUTHORIZED=0
  depends_on:
    - auth
```

### After

```yaml
frontend:
  build:
    context: ./requirements/frontend
    dockerfile: Dockerfile
  image: frontend
  container_name: frontend
  restart: always
  networks:
    - transcendence
  environment:
    - NOTES_ADDR=${NOTES_ADDR}
    - NODE_ENV=production
    - HOST=0.0.0.0
    - PORT=${AUTH_PORT}
    - NODE_TLS_REJECT_UNAUTHORIZED=0
  depends_on:
    - auth
```

---

### Change 1 — Switch Dockerfile

`dockerfile: Dockerfile.dev` → `dockerfile: Dockerfile`

The dev Dockerfile runs `pnpm run dev` (Vite dev server with HMR). That is not appropriate for
production — it is slow, unoptimised, and exposes source maps. The production Dockerfile builds the
app and serves via Nitro's Node.js server.

---

### Change 2 — Remove `args` and `user`

```yaml
# removed:
args:
  - UID=${UID:-1000}
  - GID=${GID:-1000}
user: "${UID:-1000}:${GID:-1000}"
```

These existed to solve a Linux permission problem specific to development. When source code is
bind-mounted from the host into the container, the file ownership must match between the host user
and the container process — otherwise the dev server cannot write `.nuxt/` cache files.

In production there is no bind mount. The source code is baked into the image at build time, owned
by root, and the container runs without any permission conflict. These lines are therefore removed.

---

### Change 3 — Remove all volumes

```yaml
# removed:
volumes:
  - ./requirements/frontend:/app:z
  - frontend_node_modules:/app/node_modules
  - frontend_nuxt_hidden:/app/.nuxt
  - frontend_output_hidden:/app/.output
```

Each volume served a specific dev-mode purpose:

| Volume | Dev purpose | Production need |
|---|---|---|
| `./requirements/frontend:/app:z` | Bind mount so code changes reflect instantly (HMR) | None — code is baked in |
| `frontend_node_modules` | Persist container-installed node_modules separately from host | None — `.output` is self-contained |
| `frontend_nuxt_hidden` | Persist Nuxt's type/route generation cache (`.nuxt/`) | None — build artefact already done |
| `frontend_output_hidden` | Persist Nuxt's server build (`.output/`) across restarts | None — `.output` lives inside the image |

In production, the image *is* the artefact. Mounting over it would overwrite `.output/` with
whatever is on the host — potentially nothing, or a stale dev build.

---

### Change 4 — Remove `HOME=/tmp`

```yaml
# removed:
- HOME=/tmp
```

This was a workaround for pnpm/Corepack trying to write to `$HOME/.local/share/pnpm` at dev startup
time, which failed because the container ran as a non-root user with no writable home directory.
Since the production image runs the pre-built server (no pnpm invoked at runtime), this env var is
meaningless and removed.

---

### Change 5 — `NODE_ENV=development` → `NODE_ENV=production`

Nuxt and Vue both read this at runtime. In production mode:
- Vue removes dev warnings and reactivity overhead
- Nuxt disables devtools and source maps
- Nitro enables response caching and compression

---

### Change 6 — Remove orphaned named volumes

```yaml
# removed from top-level volumes: block:
frontend_node_modules:
frontend_nuxt_hidden:
frontend_output_hidden:
frontend_manual_node_modules:
```

Named volumes declared in the top-level `volumes:` block but not referenced by any service are
harmless but misleading. They were removed to keep the compose file accurate.

---

## Verification checklist

1. `make fclean && make up` — full clean rebuild
2. `docker logs frontend` — Nitro should print: `Listening on http://0.0.0.0:3000`
3. `https://localhost:8443` — app loads through Nginx
4. `docker exec frontend ls /app` — should show only `.output`, nothing else

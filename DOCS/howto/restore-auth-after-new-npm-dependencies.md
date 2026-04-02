# Restore auth after new npm dependencies

Goal: fix **502 Bad Gateway** from nginx on `/api/auth/*` when the auth container exits on startup with `Cannot find module '<package>'`.

## Why this happens

Compose mounts the auth project at `/app` but uses a **named volume** for `/app/node_modules`. That volume keeps an older install. Adding a dependency on the host updates `package.json` and `pnpm-lock.yaml`, but the container still runs with the stale volume until dependencies are installed **inside** the container.

## What we ship to prevent repeat failures

The auth dev image uses an entrypoint that runs `pnpm install` before `pnpm run dev`, with `CI=true` so pnpm does not require a TTY when it reconciles `node_modules`.

If you changed the image (`Dockerfile.dev`) or entrypoint, rebuild the auth image.

## Steps

Rebuild and recreate the auth service:

```bash
cd srcs
docker compose build auth
docker compose up -d auth
```

Watch logs until you see the server listening on port 3000:

```bash
docker compose logs -f auth
```

Optional one-time reset of the named volume (destructive for cached modules only):

```bash
docker compose down
docker volume rm <volume_name>   # e.g. `docker volume ls | grep auth_node_modules`
docker compose up -d
```

## Verify

From the nginx container:

```bash
docker compose exec nginx curl -sS http://auth:3000/ping
```

Expect `pong`.

## Related docs

- [Verify Prometheus and Grafana metrics](verify-prometheus-and-grafana-metrics.md)
- [Monitoring architecture (explanation)](../explanation/monitoring-architecture-prometheus-grafana.md)

# Monitoring files and ports

Reference for where configuration lives and how services are reached. No procedural steps.

## Repository paths

| Item | Path |
|------|------|
| Prometheus scrape config | `srcs/requirements/prometheus/prometheus.yml` |
| Grafana datasource (Prometheus) | `srcs/requirements/grafana/provisioning/datasources/prometheus.yml` |
| Grafana dashboards (file provisioning) | `srcs/requirements/grafana/provisioning/dashboards/*.json` |
| Dashboard provider | `srcs/requirements/grafana/provisioning/dashboards/provider.yml` |
| Nginx (reverse proxy, `auth_request`) | `srcs/requirements/nginx/conf/nginx.conf` |
| Compose stack | `srcs/docker-compose.yml` |

## Docker Compose (typical host bindings)

Values depend on your `docker-compose.yml`; common mappings:

| Service | Typical host access |
|---------|---------------------|
| Grafana | `http://localhost:3000` (conflicts with other uses of 3000 on host if any) |
| Nginx | e.g. `http://localhost:8080` → container port 80 |
| Prometheus | Often **not** published; use Grafana Explore or exec into container |

Internal DNS names on network `transcendence` include `prometheus`, `grafana`, `nginx`, `auth`, `notes`, `postgres`, `nginx-exporter`, `postgres-exporter`.

## Prometheus datasource UID

Grafana provisioning sets datasource **UID** `prometheus`. Dashboard JSON references that UID.

## Nginx stub status (metrics)

Nginx listens on **8088** inside the container for `stub_status` (used by nginx-exporter), not necessarily published on the host.

# Application and infrastructure metrics

Reference for metric names, labels, HTTP paths, and scrape jobs. Generated behavior is defined in source code; this table matches the repository as documented.

## Scrape jobs (`prometheus.yml`)

| `job` label | Target |
|-------------|--------|
| `prometheus` | `prometheus:9090` |
| `nginx_exporter` | `nginx-exporter:9113` |
| `postgres_exporter` | `postgres-exporter:9187` |
| `notes` | `notes:3003` |
| `auth` | `auth:3000` |

Global scrape interval: **15s** (see `prometheus.yml`).

## Application HTTP endpoints

| Service | Path | Content-Type (typical) |
|---------|------|-------------------------|
| Notes (Axum) | `GET /metrics` | Prometheus text exposition |
| Auth (Fastify) | `GET /metrics` | From `prom-client` registry |

These endpoints are intended for **internal** scraping on the Docker network, not as public API surface.

## Notes service (Rust)

| Metric | Type | Labels | When incremented |
|--------|------|--------|------------------|
| `notes_mutations_total` | Counter | `op`: `create`, `delete` | After successful transaction commit (create) or delete with `rows_affected > 0` |

Implementation: `srcs/requirements/notes/src/metrics.rs`, `handlers.rs`.

## Auth service (Node)

| Metric | Type | Labels / notes |
|--------|------|----------------|
| `auth_login_local_total` | Counter | `result`: `success`, `fail_user_not_found`, `fail_no_local_account`, `fail_wrong_password` |
| `auth_password_verify_seconds` | Histogram | No labels; observes `argon2.verify` only when a local password hash exists |
| `auth_register_total` | Counter | `result`: `success`, `conflict_login`, `conflict_email`, `error` |
| `auth_github_callback_total` | Counter | `result`: `success_new_user`, `success_returning`, `conflict_email`, `error_oauth`, `error_github_api`, `error_create` |
| `auth_me_total` | Counter | `status`: `200`, `401`, `404` |

Implementation: `srcs/requirements/auth/src/metrics.ts`, `routes/auth.ts`, `routes/user.ts`.

## Provisioned Grafana dashboards

| Title | UID (file) |
|-------|------------|
| CPKNMS Overview | `cpknms-overview` |
| Notes metrics | `notes-metrics` |
| Auth metrics | `auth-metrics` |

Dashboard queries often filter with `job="notes"` or `job="auth"` where relevant.

## Related

- [Add a new application metric (how-to)](../howto/add-a-new-application-metric.md)
- [Monitoring files and ports](monitoring-files-and-ports.md)
- [Verify Prometheus and Grafana metrics (how-to)](../howto/verify-prometheus-and-grafana-metrics.md)

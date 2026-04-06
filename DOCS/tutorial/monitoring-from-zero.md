# Monitoring from zero: your first walkthrough

This tutorial is a **single happy path**. Follow it in order the first time you use Prometheus and Grafana with this repository. It assumes you can already start the stack with Docker Compose; it does not teach Docker itself.

You will open Grafana, confirm it can talk to Prometheus, run one query, open dashboards, and (optionally) see application metrics move after you use the app. For **why** the stack uses pull scrapes and internal networking, read [Monitoring architecture (explanation)](../explanation/monitoring-architecture-prometheus-grafana.md).

## Prerequisites

From the `srcs/` directory, bring the stack up (for example `docker compose up -d`) and wait until **grafana**, **prometheus**, **auth**, and **notes** are running. Host port mappings are defined in `docker-compose.yml`; if yours differ, use [Monitoring files and ports (reference)](../reference/monitoring-files-and-ports.md).

## Step 1 — Open Grafana

In a browser, go to **http://localhost:3000** (default mapping in this repo’s `docker-compose.yml`).

Sign in. A fresh Grafana often uses default administrator credentials until you change them; treat that as acceptable **only on a local machine**. For anything shared or on a network, change the password immediately.

**Check:** You see the Grafana home interface, not a connection error.

If port 3000 is already used by another program on your host, adjust the compose port mapping or stop the conflicting service, then try again.

## Step 2 — Confirm the Prometheus datasource

Open **Connections → Data sources** (wording may vary slightly by Grafana version). Open **Prometheus**.

The URL should point at Prometheus **inside Docker** (typically `http://prometheus:9090`). The datasource **UID** is **`prometheus`**; provisioned dashboards rely on it.

Use **Save & test** (or the equivalent).

**Check:** Grafana reports that the datasource is healthy.

If the test fails, Prometheus may not be running or the stack may not share the same Docker network. Inspect `docker compose ps` and the `prometheus` service logs.

## Step 3 — Your first query in Explore

Open **Explore**. Choose the **Prometheus** datasource.

In the query field, enter:

```promql
up
```

Run the query.

**Check:** You see multiple time series. Each has a **`job`** label. You should recognize values such as `auth`, `notes`, `nginx_exporter`, and `postgres_exporter`. The numeric value `1` usually means Prometheus reached that target on the last scrape.

`up{job="auth"}` is `0` often means the auth container is not listening (for example a crash on boot). See [Restore auth after new npm dependencies (how-to)](../howto/restore-auth-after-new-npm-dependencies.md).

## Step 4 — Open the overview dashboard

Open **Dashboards** and find **CPKNMS Overview** (provisioned from the repo; UID `cpknms-overview`).

**Check:** Panels load. Some may show little data until the stack has been up for a short time; that is normal.

## Step 5 — Use the app so metrics can move (recommended)

Application **counters** often stay invisible in PromQL until something happens. In another browser tab, open the app **through nginx** at **http://localhost:8080** (default mapping: host 8080 → container 80).

Browse a page that triggers session checks (for example a logged-in area that calls `/api/auth/me`) or create and delete a note if you have a test account.

Return to Grafana **Explore** and try:

```promql
auth_me_total
```

and:

```promql
notes_mutations_total
```

**Check:** You see at least one series, or you can see counts increase after repeating an action. If you see nothing yet, repeat the app action once; some metrics appear only after the first event.

## Step 6 — Open the auth and notes dashboards

Open **Dashboards** and locate **Auth metrics** (`auth-metrics`) and **Notes metrics** (`notes-metrics`).

**Check:** Panels render. Empty graphs usually mean no traffic in the selected time range; narrow or shift the time picker, or repeat Step 5.

## What to read next

When you need a **task** (verify scrapes deeply, add a metric, fix auth after new dependencies), use the how-to guides. When you need **exact names and paths**, use the reference.

- [Verify Prometheus and Grafana metrics (how-to)](../howto/verify-prometheus-and-grafana-metrics.md)
- [Add a new application metric (how-to)](../howto/add-a-new-application-metric.md)
- [Application and infrastructure metrics (reference)](../reference/application-and-infrastructure-metrics.md)
- [Monitoring files and ports (reference)](../reference/monitoring-files-and-ports.md)

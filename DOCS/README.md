# Documentation map (Diátaxis)

Project documentation is organized with [Diátaxis](https://diataxis.fr/): four kinds of doc match four reader needs. Headings and filenames are meant to be scannable. **The goal is to cover the whole stack** (compose services, nginx, auth, frontend, notes, editor, data layer, operations—not only observability). **Today**, the `tutorial/`, `howto/`, `reference/`, and `explanation/` folders are mostly filled around **Prometheus, Grafana, and application metrics**; other areas will land in the same shape over time.

| Need | Where |
|------|--------|
| Learning: first guided path in a topic | [tutorial/](tutorial/) — e.g. [Monitoring from zero](tutorial/monitoring-from-zero.md) |
| Doing: complete a specific task | [howto/](howto/) |
| Looking up facts (paths, names, contracts) | [reference/](reference/) |
| Understanding why things are built this way | [explanation/](explanation/) |

Older narrative notes (dated filenames, service drafts, meeting minutes) still live directly under `DOCS/`. Prefer the quadrant folders when a topic has been migrated; treat the rest as legacy until it is split or replaced.

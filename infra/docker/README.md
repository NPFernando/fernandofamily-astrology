# Docker

`Dockerfile.api` and `Dockerfile.web` live here. The actual Compose files
(`docker-compose.yml`, `docker-compose.production.yml`) live at the
**repository root**, not in this directory — Compose's default file
discovery looks there, and both files reference these Dockerfiles by path
(`infra/docker/Dockerfile.api` / `.web`), so there's a single copy of each,
not a duplicate.

Both Dockerfiles expect the **repository root** as their build context (set
automatically when building via the root `docker-compose.yml`), because
`Dockerfile.web` needs `packages/feature-registry` in addition to
`apps/web`, and `Dockerfile.api` needs `apps/api` only but is kept
context-root-relative for consistency.

See `docs/deployment/` for local development, production deployment, and
DNS/HTTPS instructions.

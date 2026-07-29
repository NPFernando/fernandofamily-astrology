# Deploying on an ARM64 host (e.g. Oracle Cloud Ampere)

The Docker images in this repo are built for both `linux/amd64` and
`linux/arm64` (see `.github/workflows/build.yml`), so an ARM64 VM — such as
an Oracle Cloud Infrastructure Ampere instance — runs them natively with no
emulation.

## Prerequisites

- Docker Engine + the Compose plugin (`docker compose version`).
- A reverse proxy already terminating TLS for other purposes on the host, or
  a willingness to let Caddy (see `infra/caddy/Caddyfile`) own ports 80/443
  directly if this is the only site on the host.
- DNS for your domain already pointing at the host (see
  [`dns-and-https.md`](dns-and-https.md)).
- Enough free disk for the vendored ephemeris data + both images
  (comfortably under 1GB total; keep an eye on overall host disk usage,
  especially if the host also runs other services).

## First deploy (manual)

```bash
git clone https://github.com/NPFernando/fernandofamily-astrology
cd fernandofamily-astrology
cp .env.example .env
# edit .env: set GIT_SHA to `git rev-parse HEAD`, review the DEFAULT_* values
docker compose -f docker-compose.yml -f docker-compose.production.yml build
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
curl http://127.0.0.1:8100/api/v1/health/ready
curl -I http://127.0.0.1:3100/
curl http://127.0.0.1:8100/metrics
```

### Optional image-delivery aggregate export

Leave `IMAGE_TELEMETRY_DASHBOARD_TOKEN` blank to keep the export route
disabled. To enable the operational-only aggregate export, generate a long
random value on the host, add it to `.env`, and restart the web container:

```bash
openssl rand -hex 32
# set IMAGE_TELEMETRY_DASHBOARD_TOKEN=<generated value> in .env
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d web
IMAGE_TELEMETRY_BASE_URL=http://127.0.0.1:3100 \
IMAGE_TELEMETRY_DASHBOARD_TOKEN='<generated value>' \
  pnpm -C apps/web telemetry:images:export
```

The output contains only process-lifetime aggregate outcome and transfer-size
buckets. Do not expose this bearer token or the endpoint through a public
dashboard.

#### Rotate the export token

Rotate this token like any operational secret: generate a new value, replace
the value in the host `.env`, restart only the web service, and verify the new
Bearer value through the loopback export command above. The old value must
then return `404`; remove it from the shell history and any temporary notes.
Because the endpoint fails closed when the variable is unset, removing the
variable is also the immediate disable procedure.

`docker-compose.production.yml` binds both services to `127.0.0.1` only —
a reverse proxy (nginx, Caddy, or otherwise) is required to actually expose
the site publicly. See [`dns-and-https.md`](dns-and-https.md).

## Subsequent deploys (CI/CD)

Once GHCR images are being published by `build.yml`, production deploys can
be automated via `.github/workflows/deploy.yml`, which:

1. Triggers after a successful `build.yml` run on `main`.
2. Waits for manual approval on the `production` GitHub Environment (set
   required reviewers on that Environment in repo settings — this repo's
   reference deployment requires the repo owner's approval before every
   deploy).
3. SSHes into the host using a **dedicated, restricted deploy key** — not a
   general-access key. The reference deployment restricts this key with a
   forced `command=` in `authorized_keys` pointing at
   `infra/deploy/run-deploy.sh`, so even if the private key were ever
   exposed, it could only ever run that one script (which itself validates
   its input is a bare image tag before doing anything), never an arbitrary
   remote shell.
4. Runs `infra/deploy/deploy.sh <image-tag>`, which pulls the new images,
   brings the stack up, health-checks it, and rolls back to the last known
   good tag on failure.

Required repository secrets for this: `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`,
`DEPLOY_SSH_KEY` (the private half of the restricted deploy key). None of
these are committed to the repository.

See [`rollback.md`](rollback.md) for what happens when a deploy fails, and
[`github-actions.md`](github-actions.md) for the full CI/CD pipeline design.

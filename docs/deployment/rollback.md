# Rollback

## Automatic rollback (during a CI/CD deploy)

`infra/deploy/deploy.sh` tracks the last successfully release-checked image
tag in a `.last-good-tag` file on the production host. On each deploy:

1. It pulls and starts the new tag.
2. It polls API readiness, the local `/en` app shell, PWA manifest, service
   worker, and API metadata for up to 60 seconds. The metadata commit must
   exactly match the image tag being deployed.
3. If any release check never succeeds, it redeploys the previous tag from
   `.last-good-tag` instead, and exits non-zero (so the GitHub Actions run
   shows as failed, even though the host ends up back in a working state).
4. If every check succeeds, `.last-good-tag` is updated to the new tag.

## Manual rollback

```bash
cd /home/ubuntu/workspace/projects/fernandofamily-astrology   # or wherever it's deployed
cat .last-good-tag                               # see what "known good" currently is
IMAGE_TAG=<previous-good-sha> docker compose \
  -f docker-compose.yml -f docker-compose.production.yml up -d --no-build
curl http://127.0.0.1:8100/api/v1/health/ready
curl -fsS http://127.0.0.1:3100/en >/dev/null
curl -fsS http://127.0.0.1:3100/manifest.webmanifest >/dev/null
curl -fsS http://127.0.0.1:3100/sw.js >/dev/null
```

Substitute any specific commit SHA that has a corresponding image in GHCR
(`ghcr.io/npfernando/fernandofamily-astrology-api:<sha>` and `-web:<sha>`) —
every commit built by `build.yml` is tagged individually, not just `latest`,
specifically so this is always possible.

## If nginx itself needs to be rolled back

The production nginx site config
(`/etc/nginx/sites-available/astrology.fernandofamily.com`) is not tracked
by this repository (it's host configuration, not application code) — keep
your own backup convention for it (e.g. timestamped copies alongside the
file, matching how other sites on the same host are typically backed up
before changes). Always run `nginx -t` before `systemctl reload nginx`
(never `restart`, which would drop connections to every site on the host,
not just this one), and re-verify unrelated domains on the same host
afterward.

## Database recovery

Rollback changes container images only; it does not restore account
preferences, profiles, or push subscriptions. Database backups and a monthly
isolated restore drill are documented in
[`database-backups.md`](database-backups.md). Never point the drill at the
production database. A production data restore requires a separate approved
incident runbook and two-person review of the archive and destination.

## Verifying a rollback worked

- `curl https://astrology.fernandofamily.com/api/v1/health/ready` — `200`,
  and `deployed_commit` in `/api/v1/metadata` matches the tag you rolled
  back to.
- `curl -I https://astrology.fernandofamily.com/` — `200`/`307`, normal
  security headers.
- Confirm any other site sharing the host is unaffected.

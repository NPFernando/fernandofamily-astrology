# GitHub Actions / CI-CD pipeline

Four workflows, all on GitHub-hosted runners (no self-hosted runner — see
the note below on why):

## `ci.yml`

Runs on every push and pull request:

- Backend: `pytest apps/api/tests`, `ruff check`, and
  `apps/api/scripts/verify_vendor.py` (checksum + import + calculation
  sanity check against the vendored, pinned PyJHora source).
- Frontend: `pnpm lint`, `npx tsc --noEmit`, `pnpm build`, `pnpm test`
  (including the i18n-hygiene and no-birth-fields-in-URL checks).

## `build.yml`

Runs on push to `main`. Builds both Docker images for `linux/amd64` and
`linux/arm64` via `docker buildx` + QEMU, tags them with the commit SHA and
`latest`, and pushes to `ghcr.io/<owner>/fernandofamily-astrology-{api,web}`
(owner is lowercased automatically — GHCR image names must be lowercase even
if the GitHub username isn't). Passes the commit SHA as a build arg so the
running API can report exactly which commit it was built from
(`GET /api/v1/metadata` → `deployed_commit`), which matters for AGPL-3.0 §13
compliance — see [`../licensing.md`](../licensing.md).

## `release.yml`

Runs on `v*` tag push. Creates a GitHub Release with an auto-generated
changelog, and fails the release if `.env.example`'s `PYJHORA_COMMIT` has
drifted from `apps/api/vendor/pin.json`'s recorded commit — a safety check
against accidentally re-vendoring the engine without updating the
documented pin.

## `deploy.yml`

Triggers via `workflow_run` after `build.yml` succeeds on `main`. The job
declares `environment: production`, so it will not run until manually
approved if the `production` Environment has required reviewers configured
(repo Settings → Environments → production → required reviewers — this is a
repo-level setting, not something the workflow file itself can safely
configure, since anyone who could edit the workflow file would otherwise be
able to remove their own review gate).

Once approved, it SSHes into the production host and runs
`infra/deploy/run-deploy.sh` (forced by the deploy key's `authorized_keys`
restriction) with the new commit SHA as the only thing sent over the wire —
that script validates the input is a bare tag, then hands off to
`infra/deploy/deploy.sh`, which does the actual `docker compose pull` +
`up -d` + health check + rollback-on-failure.

### Why no self-hosted runner

A self-hosted GitHub Actions runner would give native ARM64 builds and avoid
managing SSH secrets — but GitHub's own guidance advises against self-hosted
runners on **public** repositories: a pull request from any contributor can
execute arbitrary workflow code, and a self-hosted runner would run that
code on whatever machine it's installed on. If that machine also hosts
anything sensitive, this is a real risk, not a theoretical one. This
pipeline instead uses GitHub-hosted runners everywhere (arm64 images built
via QEMU emulation — slower, but fully isolated from production), and a
narrowly-scoped SSH key for the one thing that actually needs host access:
the deploy step itself, and even that only after manual approval.

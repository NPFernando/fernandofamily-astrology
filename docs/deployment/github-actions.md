# GitHub Actions / CI-CD pipeline

Six workflows, all on GitHub-hosted runners (no self-hosted runner — see
the note below on why):

## `ci.yml`

Runs on every push and pull request:

- Backend: `pytest apps/api/tests`, `ruff check`, and
  `apps/api/scripts/verify_vendor.py` (checksum + import + calculation
  sanity check against the vendored, pinned PyJHora source).
- Frontend: `pnpm lint`, `npx tsc --noEmit`, `pnpm build`, `pnpm test`
  (including the i18n-hygiene and no-birth-fields-in-URL checks).
- Deployment-script safety: ShellCheck plus hermetic tests for the database
  backup archive and the restore drill's production-database refusal.
- Browser: a production standalone build plus the Playwright suite. On
  failure, its traces, screenshots, and error-context files are retained as
  the `e2e-failure-artifacts` workflow artifact for 14 days.

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
`up -d` + API/web/PWA/commit release checks + rollback-on-failure.

If `MONITORING_ENABLED=1` is present in the production host's `.env`, the
same deploy also starts the loopback-only monitoring profile. It requires the
file-backed Grafana password and alert webhook described in
[`monitoring.md`](monitoring.md); deployment fails closed if either file is
missing.

## `public-smoke.yml`

Runs hourly and on manual dispatch from a GitHub-hosted runner. It requires
exact `200` HTTPS responses for the public English page, API readiness route,
web manifest, and service worker; it also checks the expected public document
markers without writing their bodies to the log. This provides an off-host
signal for DNS, TLS, edge-routing, and stale-asset failures. Set the optional
repository variable `PUBLIC_SMOKE_BASE_URL` before changing the canonical
public domain; it is not a secret.

## `security.yml`

Runs CodeQL's extended security queries for Python and JavaScript/TypeScript
on pull requests, pushes to `main`, manual dispatch, and a weekly schedule.
It also performs a redacted Git-history credential scan. Configure the
`CodeQL` matrix checks and `Secret scan` as required branch-protection checks
for `main`; workflow files alone cannot prevent an administrator from merging
around a failed check. CodeQL uses its documented no-build mode for these
interpreted languages. [CodeQL action guidance](https://github.com/github/codeql-action)

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

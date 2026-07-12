# Fernando Family Astrology

Open-source bilingual (English / Sinhala) astrology platform powering
[astrology.fernandofamily.com](https://astrology.fernandofamily.com), starting
with an accurate, live **Pancha Pakshi** timetable
([`/pancha-pakshi`](https://astrology.fernandofamily.com/pancha-pakshi)) —
zero-click today view, date navigation, timeline/table/week views, favourable-
window search (`POST /api/v1/pancha-pakshi/windows`), and saved profiles that
stay on your device (with optional invite-only account sync).

This repository is public because it depends on AGPL-3.0-licensed code
(PyJHora, Swiss Ephemeris) and the deployed site must make the corresponding
source available to its users — see [Licensing](#licensing).

## Architecture

```
apps/web/       Next.js frontend — App Router, TypeScript strict, bilingual (en/si), PWA
apps/api/       FastAPI backend — stateless Pancha Pakshi calculation API
packages/       Shared feature registry, contracts, design system
infra/          Docker, Caddy (reference), deployment scripts
docs/           Architecture, calculations, deployment, licensing, privacy, roadmap
```

More detail:
[`docs/architecture/platform.md`](docs/architecture/platform.md) ·
[`docs/architecture/pancha-pakshi.md`](docs/architecture/pancha-pakshi.md)

## Feature registry / current module

The only tool live in production today is Pancha Pakshi. The platform is
built around a feature registry (`packages/feature-registry`) so future
tools can be added without touching the platform shell or this module —
see [`docs/roadmap.md`](docs/roadmap.md) for what's planned but explicitly
**not yet implemented** (nothing on that list appears in production
navigation or the sitemap).

## Calculation engine

Pancha Pakshi calculations are powered by
[PyJHora](https://github.com/naturalstupid/PyJHora), pinned to release
`V4.8.7` (commit `ca22995709bd60e371e7820a1a5efc80ce4cf821`), vendored and
checksummed under `apps/api/vendor/jhora/` —
[`apps/api/vendor/MANIFEST.sha256`](apps/api/vendor/MANIFEST.sha256) is
verified in CI, at container build time, and on every readiness check
(`apps/api/scripts/verify_vendor.py`), so a corrupted or drifted vendor tree
fails loudly instead of silently producing wrong results.

Full detail on the calculation methodology:
[`docs/calculations/birth-bird.md`](docs/calculations/birth-bird.md) ·
[`docs/calculations/schedule.md`](docs/calculations/schedule.md) ·
[`docs/calculations/timezones.md`](docs/calculations/timezones.md)

## Local development

### Backend

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
pytest tests -v                                  # 127+ tests
python scripts/verify_vendor.py --mode full       # engine integrity check
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd apps/web
pnpm install
pnpm dev            # :3000, proxies /api to the backend above
npx tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

## Docker development

```bash
cp .env.example .env   # edit as needed; GIT_SHA defaults to "dev"
docker compose -f docker-compose.yml -f docker-compose.production.yml build
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d
curl http://127.0.0.1:8100/api/v1/health/ready
curl -I http://127.0.0.1:3100/
```

The production compose overlay binds both services to `127.0.0.1` only — a
reverse proxy is required to expose them publicly (see below).

## Production deployment

- [`docs/deployment/oci-arm64.md`](docs/deployment/oci-arm64.md) — first
  manual deploy + how CI/CD deploys work afterward
- [`docs/deployment/dns-and-https.md`](docs/deployment/dns-and-https.md) —
  DNS records, reverse proxy options, certificate issuance
- [`docs/deployment/github-actions.md`](docs/deployment/github-actions.md) —
  the full CI/build/release/deploy pipeline, and why it deliberately does
  **not** use a self-hosted runner
- [`docs/deployment/rollback.md`](docs/deployment/rollback.md) — automatic
  and manual rollback

## Environment variables

See [`.env.example`](.env.example) for the full list (no secrets committed).
Deploy-time secrets (`DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`)
are GitHub Actions repository secrets, never files in this repo.

## Testing

- Backend: `pytest apps/api/tests` — birth-bird mapping (all 27 Nakshatras ×
  both Pakshas), schedule invariants (5 birds × 7 weekdays × 2 Pakshas —
  exactly 10 major/50 sub-periods, no gaps/overlaps), timezone/DST/leap-day/
  before-sunrise edge cases, golden tests against the pinned engine's own
  reference output, and structural checks (no birth data ever logged, no
  birth fields on any `GET` route).
- Frontend: `pnpm test` — i18n hygiene (no hardcoded user-facing strings),
  no-birth-fields-in-URLs.
- End-to-end: `pnpm e2e` (from `apps/web`, needs `apps/api/.venv`) — real
  Chromium against the production build + real API: all three input methods
  in both locales, zero-click load, saved profiles, language persistence,
  table/week views, date navigation, mobile 360px, and a no-birth-data-in-URLs
  watcher across every flow.
- Contracts: `node packages/contracts/generate.mjs` regenerates the OpenAPI
  schema + TypeScript types; CI fails if they drift from the committed copies.
- CI runs all of the above on every push/PR — see
  [`docs/deployment/github-actions.md`](docs/deployment/github-actions.md).

## GitHub Actions / container images

Multi-arch (`linux/amd64` + `linux/arm64`) images are published to
`ghcr.io/npfernando/fernandofamily-astrology-{api,web}`, tagged by commit SHA
and `latest`, on every push to `main`. See
[`docs/deployment/github-actions.md`](docs/deployment/github-actions.md).

## Safe engine upgrade procedure

See [`docs/licensing.md`](docs/licensing.md#safe-upgrade-process-for-the-calculation-engine)
— the pin is deliberate; production never tracks upstream PyJHora `main`.

## Licensing

AGPL-3.0 for the entire repository — see [`LICENSE`](LICENSE),
[`NOTICE.md`](NOTICE.md), [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md),
and [`docs/licensing.md`](docs/licensing.md) (including a note on an
inconsistency in PyJHora's own packaging metadata, and why AGPL-3.0 is
nonetheless the correct, verified license for the vendored engine).

## Privacy & disclaimer

- [`docs/privacy.md`](docs/privacy.md) — no accounts, no server-side
  storage of birth data, what's in browser local storage and how to clear it
- The Pancha Pakshi tool displays a prominent bilingual disclaimer
  (traditional/cultural system, not scientifically validated, not a
  substitute for professional advice) on every relevant page

## Sinhala translation maintenance

All user-facing strings live in `apps/web/locales/{en,si}.json` (plus
`nakshatras.json` for the 27 Nakshatra names) — never hardcoded in
components, enforced by an i18n-hygiene check in CI. To update or extend
Sinhala copy, edit `si.json` directly; keys must stay in sync with `en.json`.

## Contributing

Issues and pull requests are welcome. Please don't submit changes that
re-derive or "correct" the Pancha Pakshi lookup data or birth-bird mapping
without checking them against the pinned PyJHora commit first — see
[`docs/calculations/`](docs/calculations/) for how each value is meant to be
sourced.

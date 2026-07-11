# Contributing

Thanks for your interest in Fernando Family Astrology.

## Before you start

- For anything beyond a small fix, open an issue first to discuss the
  approach — especially for anything touching the Pancha Pakshi calculation
  logic (`apps/api/app/modules/pancha_pakshi/`) or the vendored engine
  (`apps/api/vendor/`).
- **Do not** hand-edit the vendored PyJHora source
  (`apps/api/vendor/jhora/`) or its checksum manifest
  (`apps/api/vendor/MANIFEST.sha256`) directly — see
  [`docs/licensing.md`](docs/licensing.md#safe-upgrade-process-for-the-calculation-engine)
  for the correct process to re-vendor a new pinned release.
- **Do not** "correct" the birth-bird mapping table, the Pancha Pakshi
  lookup data, or the schedule algorithm based on general astrology
  literature without first checking it against the pinned PyJHora commit —
  see [`docs/calculations/`](docs/calculations/) for how each value is
  sourced and why some of them (e.g. equal-duration major periods, per-period
  Bharana Pakshi) may differ from what's commonly described elsewhere.

## Development setup

See the README's [Local development](README.md#local-development) and
[Docker development](README.md#docker-development) sections.

## Before opening a pull request

- Backend: `pytest apps/api/tests -v` and `ruff check` must pass; if you
  touch `calculator.py` or `repository.py`, the golden tests
  (`apps/api/tests/golden/`) must still pass against the pinned engine's
  actual reference output — a change that "fixes" a golden test by editing
  the fixture instead of the code is almost certainly wrong.
- Frontend: `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm test` must
  pass, including the i18n-hygiene check (no hardcoded user-facing strings)
  and the no-birth-fields-in-URLs check.
- If you add or change user-facing text, update both `locales/en.json` and
  `locales/si.json` together — don't leave one locale out of sync.
- CI runs all of the above automatically on your pull request.

## Commit messages

Explain *why*, not just *what* — the diff already shows what changed.

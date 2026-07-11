# Licensing

## This repository

Fernando Family Astrology is licensed under the **GNU Affero General Public
License v3.0 (AGPL-3.0)** in its entirety — see [`../LICENSE`](../LICENSE).
Because this is a network-accessed service, AGPL-3.0 §13 requires that users
interacting with it over a network be offered the corresponding source of the
exact version they're using. This repository satisfies that by:

- Linking to this public repository from the site footer on every page.
- Exposing the exact deployed git commit SHA via `GET /api/v1/metadata`
  (`deployed_commit`), so the running instance's source can always be
  located precisely, not just approximately by release tag.

## Calculation engine: PyJHora

- **Repository**: https://github.com/naturalstupid/PyJHora
- **Pinned release**: `V4.8.7`
- **Pinned commit**: `ca22995709bd60e371e7820a1a5efc80ce4cf821`
- **Vendored, checksummed copy**: `apps/api/vendor/jhora/`, verified against
  `apps/api/vendor/MANIFEST.sha256` by `apps/api/scripts/verify_vendor.py` in
  CI, at container build time, and on every readiness check.

### A note on PyJHora's own license metadata

At the pinned commit, PyJHora's licensing metadata disagrees with itself in
three places:

| Source | Claim |
|---|---|
| `LICENSE` file (repository root) | GNU Affero General Public License v3.0 (full AGPL-3.0 text) |
| `pyproject.toml` `classifiers` | `License :: OSI Approved :: MIT License` |
| Legacy `_package_info.py` docstring | References GPLv3 |

We treat the actual `LICENSE` file — AGPL-3.0 — as authoritative, since it is
the operative license grant, not a packaging classifier or a docstring. This
is documented here explicitly so the discrepancy reads as an upstream
inconsistency we've verified and accounted for, not an attribution error of
our own.

### Why AGPL-3.0 propagates to this whole repository

Because the vendored PyJHora source is AGPL-3.0 and this platform is a
network service built on it, the whole repository is licensed AGPL-3.0 to
comply with copyleft propagation and to guarantee downstream users the same
freedoms.

## Swiss Ephemeris

Ephemeris data (`apps/api/vendor/jhora/data/ephe/`) originates from the Swiss
Ephemeris project (Astrodienst AG), as redistributed within the pinned
PyJHora commit above, and is likewise AGPL-3.0. See
[`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) for the full
dependency list.

## Safe upgrade process for the calculation engine

The engine pin is deliberate — production must never silently track upstream
`main`. To upgrade to a newer PyJHora release:

1. Identify the target upstream tag/commit and read its changelog/diff
   against `ca22995`, specifically for any change to `pancha_pakshi_db.csv`,
   `pancha_paksha.py`, or the birth-bird mapping table.
2. Re-run the vendoring process against the new commit into a separate
   branch: re-copy the trimmed (or full, if needed) source tree, regenerate
   `MANIFEST.sha256` and `pin.json` from the new commit's exact bytes.
3. Re-run the full golden test suite (`apps/api/tests/golden/`) — any
   numeric drift from the previous pin must be understood and intentional,
   not silently accepted.
4. Update `PYJHORA_VERSION` / `PYJHORA_COMMIT` in `.env.example` and any
   deployed `.env` to match.
5. Deploy through the normal CI/CD pipeline (never hand-patch a running
   container's vendored source) and confirm `/api/v1/metadata` and
   `/api/v1/health/ready` report the new version/commit/checksums correctly
   before considering the upgrade complete.

## Third-party notices

See [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) for the full
list of vendored and depended-upon third-party software and their licenses.

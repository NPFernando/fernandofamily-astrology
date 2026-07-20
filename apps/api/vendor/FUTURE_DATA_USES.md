# Vendored data retained for future features

The Docker image ships only a trimmed subset of the vendored data (see
`README.md` in this directory and `infra/docker/Dockerfile.api`): the
`sepl_18.se1` + `semo_18.se1` ephemeris pair (1800–2399 CE) plus
`seleapsec.txt` — everything real users need for births from 1800 onward and
target dates centuries ahead.

**Everything else stays in this repository on purpose.** This file catalogs
what that retained-but-not-shipped data enables, so future features can be
built by simply widening the Dockerfile's curated copy list (and the
image-profile date bounds in
`apps/api/app/modules/pancha_pakshi/validation.py`) — no re-vendoring, no new
checksums, no upstream trips.

## Retained in `jhora/data/ephe/` (not shipped in the image)

| Data | Size | Future features it enables |
|---|---|---|
| `seplm*.se1` + `semom*.se1` (BCE-era ephemeris, ~13200 BCE onward) | ~44 MB | Historical/ancestral chart tools; long-range astronomical research features; "on this day in history" panchanga |
| `sepl_00.se1`–`sepl_162.se1`, `semo_*.se1` beyond the shipped 1200–2399 pairs | ~50 MB | Extending supported dates further in either direction (600 CE and earlier, or far-future muhurta research). The `sepl_12`/`semo_12` pair (1200–1799 CE) **shipped in the image 2026-07-20** for the historical/ancestor-charts range widening |
| `seasnam.txt` | 10 MB | Asteroid *name* lookups only. **Correction (2026-07-20):** these text files do NOT enable asteroid positions — the binary `seas_*.se1` position ephemeris was never vendored (it isn't in the repo at all), and the engine has no asteroid code paths. Asteroid features would need a fresh upstream re-vendor of `seas_*.se1` plus net-new computation code — and were ruled out on cultural grounds anyway (see `docs/jyotishya-ideas.md`) |
| `ast_list.txt`, `seorbel.txt` | <20 KB | Asteroid/orbital-element support files — same correction as above |
| `fixstars.cat` | ~118 KB | Legacy-format fixed-star catalog (unused; `swe.fixstar_ut` reads `sefstars.txt`, which **now ships in the image** for the birth chart's yogatara layer — no longer image-trimmed) |

## Upstream PyJHora data NOT currently vendored (re-vendor when needed)

These live in the pinned upstream release (`ca22995`) but were excluded from
the original trimmed vendor set; the safe re-vendoring process is documented
in `docs/licensing.md`.

| Upstream path | Future features it enables |
|---|---|
| `src/jhora/lang/*` (Tamil, Telugu, Kannada, Hindi resource strings) | Tamil (and other) locales for the platform — note our UI translations live in `apps/web/locales/`, but these upstream files are useful reference vocabulary for astrological terms |
| `src/jhora/data/*geo*` databases used by `place_db.py` (~84 MB) | Offline place search (no dependency on the Open-Meteo geocoding API); nearest-city lookup for raw coordinates |
| `src/jhora/panchanga/{vratha,eclipse,...}.py` modules | Festival/vratha calendar module; eclipse predictions for the Panchanga module |

## How to widen the shipped range

1. Add the needed files to the curated `cp` list in `infra/docker/Dockerfile.api`.
2. Regenerate `MANIFEST.image.sha256` (instructions in `README.md` here).
3. Relax the image-profile date bounds in `validation.py` to match the new coverage.
4. Golden tests + `verify_vendor.py --profile image` must pass — calculations
   must remain bit-identical wherever the ranges overlap.

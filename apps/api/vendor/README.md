# Vendored PyJHora engine

This directory contains a checksummed, trimmed vendor copy of
[PyJHora](https://github.com/naturalstupid/PyJHora), pinned to release
`V4.8.7` (commit `ca22995709bd60e371e7820a1a5efc80ce4cf821`), licensed
AGPL-3.0.

## Why vendored instead of `pip install`

`pyproject.toml`'s `[tool.setuptools.package-data]` section only declares
`*.txt`/`*.csv`/`*.md`/`*.json` plus the `jhora.lang`/`jhora.images`/`jhora.tests`
packages — it does not cover the Swiss Ephemeris binary files (`*.se1`,
`*.cat`) under `jhora/data/ephe/`. A plain `pip install pyjhora==4.8.7` does
not reliably ship these, so the engine source and its required data files are
vendored directly from the pinned git commit instead, and checksummed
(`MANIFEST.sha256`) so the exact bytes deployed can always be verified against
the exact bytes fetched from that commit.

## What's vendored (trimmed set, not the full upstream tree)

From `src/jhora/` at the pinned commit:

- `__init__.py`, `_package_info.py`, `config.py`, `const.py`, `utils.py`,
  `place_db.py`
- `panchanga/__init__.py`, `panchanga/drik.py`, `panchanga/pancha_paksha.py`
- `data/pancha_pakshi_db.csv`, `data/factory_settings.json`,
  `data/user_settings.json`, `data/ephe/*` (106 Swiss Ephemeris files)
- `lang/msg_strings_en.txt`, `lang/list_values_en.txt` — required because
  `jhora/utils.py` loads `resource_strings` for `const._DEFAULT_LANGUAGE`
  (`'en'`) unconditionally at module import time, not lazily. Only the
  English-language files are vendored; the calculation code path used by
  this project never calls `set_language()` or reads translated strings —
  these two files exist purely to satisfy that import-time load.
- `horoscope/__init__.py`, `horoscope/chart/__init__.py`,
  `horoscope/chart/house.py`, `horoscope/chart/sphuta.py`,
  `horoscope/chart/charts.py`, `horoscope/dhasa/__init__.py`,
  `horoscope/dhasa/graha/__init__.py`,
  `horoscope/dhasa/graha/shastihayani.py`,
  `horoscope/dhasa/graha/vimsottari.py` — the trimmed subset of
  `jhora/horoscope/` needed for Vimshottari Dasha
  (`get_vimsottari_dhasa_bhukthi`, `get_running_dhasa_for_given_date`),
  traced empirically by reconstructing the tree and calling both
  functions under this project's venv, including a deliberate
  `ImportError` boundary test. `house.py`/`sphuta.py`/`charts.py` are
  pulled in as `charts.py`'s own unconditional dependencies, not by
  choice — `sphuta` in particular is imported unconditionally inside
  `charts.get_chart_element_longitude` even though its functions are
  only called for non-default `dhasa_starting_planet` values.
  `dhasa/graha/__init__.py` is vendored as the real upstream file
  (not an empty stub, to preserve this project's byte-identical
  checksummed-manifest discipline for every vendored file), which is
  why `shastihayani.py` is present too — it's an eager import inside
  that `__init__.py`, not a Vimshottari dependency itself. Confirmed
  zero PyQt6/pyqtgraph/tkinter/matplotlib imports anywhere in this
  closure; `jhora/horoscope/main.py` (PyQt UI, ~1800 lines) is never
  transitively imported and stays fully excluded.

Not vendored: the rest of `jhora/horoscope/` (`main.py`,
`chart/arudhas.py` — only needed for Arudha Lagna dhasa, which nothing
calls yet — `dhasa/raasi/*`, `transit/`, `match/`, `prediction/`, etc.),
`jhora/ui/` (PyQt-dependent, never imported by our call path), other
`panchanga/*.py` siblings (`drik1.py`, `eclipse.py`, `hijri.py`,
`khanda_khaadyaka.py`, `surya_sidhantha.py`, `vratha.py` — not imported
by `drik.py`/`pancha_paksha.py`/the vendored `horoscope/` subset), the
geonames place-lookup database and marriage-compatibility spreadsheet
under `data/` (only used by `place_db.py`'s UI/horoscope features, not
by sunrise/Pancha-Pakshi/Dasha calculations), and all non-English
`lang/` files.

## Runtime dependencies

Confirmed by direct testing: importing `jhora`, `jhora.config`, `jhora.const`,
`jhora.utils`, `jhora.panchanga.drik`, and `jhora.panchanga.pancha_paksha` —
and running sample sunrise/weekday/paksha/nakshatra/schedule calculations —
produces identical results with and without `PyQt6`/`pyqtgraph` installed.
Neither package is imported by this call chain. They are excluded from the
production runtime; see `pin.json` for the full dependency list.

Note `jhora/utils.py` imports the `geocoder` package at module load time even
though it is unused by the sunrise/Pancha-Pakshi calculation path — it must
still be installed for `import jhora` to succeed.

## Verifying integrity

```
python3 apps/api/scripts/verify_vendor.py --mode full
```

Checks every file in `MANIFEST.sha256` against its recorded SHA-256, the CSV
schema and row count (3500 data rows), the pinned version/commit in
`pin.json`, and runs a live import + calculation smoke test. `--mode fast`
skips the full schedule calculation for use in the `/api/v1/health/ready`
route. This is the single verifier used identically in CI, the API Docker
build, and readiness checks.

## Upgrading the pin

1. Pick the new upstream tag/commit, re-run the vendoring steps above against
   it, and regenerate `MANIFEST.sha256` and `pin.json` from the new source.
2. Re-run `verify_vendor.py --mode full` and the full backend test suite
   (including golden tests) against the new vendor tree before merging.
3. Update `PYJHORA_VERSION`/`PYJHORA_COMMIT` in `.env.example` to match.
4. Never silently reuse a previous checksum manifest — always regenerate it
   from the newly fetched source.

## Image vs repo profiles

The repository keeps the complete vendored dataset (see
`FUTURE_DATA_USES.md` for why and what the retained data enables). The
Docker image ships a trimmed copy — everything except `jhora/data/ephe/`,
plus only `sepl_18.se1`, `semo_18.se1`, `seleapsec.txt` (1800–2399 CE
coverage), and `sefstars.txt` (the fixed-star catalog the birth chart's
yogatara layer resolves junction stars from; ~134 KB). ~3 MB total instead
of ~105 MB.

- `MANIFEST.sha256` — full repo tree (verified in CI and at the start of the
  Docker build; `--profile repo`).
- `MANIFEST.image.sha256` — the shipped subset (verified after the trimmed
  copy is assembled in the build and by the readiness probe inside the
  container, which runs with `FF_VENDOR_PROFILE=image`; `--profile image`).

Regenerate the image manifest after changing the curated file list (keep it
in sync with the `cp` list in `infra/docker/Dockerfile.api`):

```bash
cd apps/api
python3 - <<'PY'
keep = {"data/ephe/sepl_18.se1", "data/ephe/semo_18.se1", "data/ephe/seleapsec.txt",
        "data/ephe/sefstars.txt"}
lines = [l for l in open("vendor/MANIFEST.sha256").read().splitlines()
         if l.strip() and (not l.split("  ", 1)[1].startswith("data/ephe/")
                           or l.split("  ", 1)[1] in keep)]
open("vendor/MANIFEST.image.sha256", "w").write("\n".join(lines) + "\n")
PY
```

Outside the shipped 1800–2399 range, swisseph does **not** raise — it
silently falls back to its built-in lower-precision theory. That's why the
API rejects out-of-range dates with a controlled error when
`FF_VENDOR_PROFILE=image` (see `validation.py`): silent approximation is
never acceptable here.

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

Not vendored: `jhora/horoscope/`, `jhora/ui/` (PyQt-dependent, never imported
by our call path), other `panchanga/*.py` siblings (`drik1.py`, `eclipse.py`,
`hijri.py`, `khanda_khaadyaka.py`, `surya_sidhantha.py`, `vratha.py` — not
imported by `drik.py`/`pancha_paksha.py`), the geonames place-lookup database
and marriage-compatibility spreadsheet under `data/` (only used by
`place_db.py`'s UI/horoscope features, not by sunrise/Pancha-Pakshi
calculations), and all non-English `lang/` files.

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

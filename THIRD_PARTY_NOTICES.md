# Third-Party Notices

This project incorporates and depends on the following third-party software.
Original copyright and license notices are preserved in the vendored source
itself (see `apps/api/vendor/jhora/`) in addition to being summarized here.

## PyJHora (calculation engine, vendored)

- **Repository**: https://github.com/naturalstupid/PyJHora
- **Pinned release**: `V4.8.7`
- **Pinned commit**: `ca22995709bd60e371e7820a1a5efc80ce4cf821`
- **Author**: Sundar Sundaresan (carnaticmusicguru2015@comcast.net), building
  on prior work by Open Astro Technologies, USA
- **License**: GNU Affero General Public License v3.0 (AGPL-3.0), per the
  `LICENSE` file at the pinned commit — see [`docs/licensing.md`](docs/licensing.md)
  for a note on an inconsistency in that project's own packaging metadata.
- **Vendored location**: `apps/api/vendor/jhora/` — a trimmed subset of the
  upstream source tree (core astronomy/panchanga modules, the Pancha Pakshi
  database, ephemeris data, and English resource strings) sufficient to run
  the calculations this platform uses, excluding the PyQt6-based desktop UI,
  which this project does not use. Checksums for every vendored file are in
  `apps/api/vendor/MANIFEST.sha256`.

## Swiss Ephemeris / pyswisseph

- **Project**: Swiss Ephemeris, by Astrodienst AG
- **Python binding**: `pyswisseph` (PyPI), version `2.10.3.2`
- **License**: AGPL-3.0 (Astrodienst also offers a separate professional
  license for parties who do not want AGPL obligations; this project uses
  the AGPL-licensed distribution, consistent with the rest of the codebase).
- **Ephemeris data files**: vendored under `apps/api/vendor/jhora/data/ephe/`,
  sourced from the pinned PyJHora commit above (not from a separate Swiss
  Ephemeris download), checksummed in the same manifest.

## Other Python runtime dependencies

The API's calculation path depends on: `numpy`, `pytz`, `geopy`, `requests`,
`timezonefinder`, `python-dateutil`, `certifi`, and `geocoder` — each under
its own permissive (BSD/MIT/Apache-2.0-family) license, used unmodified via
PyPI. `PyQt6` and `pyqtgraph`, which upstream PyJHora's own `requirements.txt`
lists as dependencies of its desktop UI, are confirmed **not** required for
the calculation modules this project vendors and are deliberately excluded
from the runtime image.

## Frontend dependencies, fonts, and icons

To be appended here as they are selected during frontend implementation —
only originally-licensed or open-licensed fonts, icons, and packages will be
used (see the platform spec's prohibition on unlicensed/commercial assets).

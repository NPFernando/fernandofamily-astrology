"""Sole boundary permitted to import vendored `jhora` for this module — thin
pass-throughs only, no enums, no business logic.

D1 (Rasi) is the base chart, not "a divisional chart with factor 1" in any
derived sense — `graha_positions` calls `drik.dhasavarga(..., 1)` directly
(its own docstring: `divisional_chart_factor = 1 => Rasi`) and
`ascendant_rashi` uses `drik.ascendant()`'s constellation directly, skipping
the `dasavarga_from_long` re-projection `divisional_charts.adapter` needs for
D9+: verified that `dasavarga_from_long(longitude, 1)` reduces to
`int(longitude / 30)` (`one_sign` becomes exactly 360 at factor 1), which is
byte-for-byte what `ascendant()` already computes for its own `constellation`
return value — so re-deriving it via the varga path would be a no-op
round-trip, not a correctness requirement.
"""
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

import swisseph as swe  # noqa: E402
from jhora.panchanga import drik  # noqa: E402

from app.modules.birth_chart.yogatara import YOGATARA_STARS  # noqa: E402

configure_ayanamsa(drik)

# Same flag combination the vendored tree itself uses for its own fixed-star
# call (jhora/utils.py's True-Chitra helper): Swiss Ephemeris files + the
# currently configured sidereal mode (LAHIRI, via configure_ayanamsa).
_FIXSTAR_FLAGS = swe.FLG_SWIEPH | swe.FLG_SIDEREAL


def ensure_ayanamsa() -> None:
    """Call at the top of every calculator entry point — see
    configure_ayanamsa's docstring for why the import-time call above isn't
    sufficient on its own."""
    configure_ayanamsa(drik)


def graha_positions(jd: float, p) -> list:
    """[(planet_id 0..8, (constellation 0..11, long_in_raasi)), ...] for the
    9 grahas at the given moment — Rasi/D1 chart. Does NOT include the
    Ascendant/Lagna, see ascendant_rashi below. planet_id order matches
    panchanga.repository.GRAHA_KEYS (Sun..Ketu)."""
    return drik.dhasavarga(jd, p, divisional_chart_factor=1)


def ascendant_rashi(jd: float, p) -> tuple[int, float]:
    """(constellation 0..11, degrees within that rashi 0..30) of the
    Ascendant/Lagna at the given birth moment, taken directly from
    drik.ascendant()."""
    constellation, coordinates, _nak_no, _paadha_no = drik.ascendant(jd, p)
    return constellation, coordinates


def yogatara_longitudes(jd: float, p) -> list[tuple[str, float]]:
    """[(nakshatra_key, sidereal longitude 0..360), ...] for the 27 CRC
    Table-5 junction stars at the given moment, NAKSHATRA_KEYS order.

    Direct `swe` use in an adapter follows panchanga/adapter.py's eclipse
    precedent. The local-JD -> UT conversion mirrors drik.dhasavarga's own
    `jd_utc = jd - place.timezone / 24` line, so star and graha longitudes
    are computed for the identical instant (the shift is ~1e-5 arcsec of
    precession either way, but consistency keeps the comparison honest)."""
    jd_utc = jd - p.timezone / 24.0
    return [
        (nakshatra_key, swe.fixstar_ut(search_key, jd_utc, _FIXSTAR_FLAGS)[0][0])
        for nakshatra_key, search_key, _label in YOGATARA_STARS
    ]

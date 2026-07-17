"""Sole boundary permitted to import vendored `jhora` for this module — thin
pass-throughs only, no enums, no business logic.

Verified directly against the pinned vendored source (no test fixtures exist
anywhere in the vendored tree for divisional charts, unlike every other
feature this session — see calculator.py's docstring for how correctness
was independently validated instead): `dhasavarga`/`ascendant` both already
correctly convert local-embedded jd to genuine UT before calling
`sidereal_longitude()`/`swe.houses_ex()` — checked specifically, since three
other vendored functions touched this session (`planetary_positions()`,
`next_lunar_eclipse()`, `vivaha_chakra_palan()`) all had real UT-conversion
bugs. This one does not.
"""
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

from jhora.panchanga import drik  # noqa: E402

configure_ayanamsa(drik)


def ensure_ayanamsa() -> None:
    """Call at the top of every calculator entry point — see
    configure_ayanamsa's docstring for why the import-time call above isn't
    sufficient on its own."""
    configure_ayanamsa(drik)


def dhasavarga(jd: float, p, divisional_chart_factor: int) -> list:
    """[(planet_id 0..8, (constellation 0..11, long_in_raasi)), ...] for the
    9 grahas at the given moment — does NOT include the Ascendant/Lagna, see
    ascendant_varga_sign below. planet_id order matches
    panchanga.repository.GRAHA_KEYS (Sun..Ketu)."""
    return drik.dhasavarga(jd, p, divisional_chart_factor=divisional_chart_factor)


def ascendant_varga_sign(jd: float, p, divisional_chart_factor: int) -> int:
    """0-based varga-chart constellation (0=Aries) of the Ascendant/Lagna at
    the given birth moment. drik.ascendant() returns the D1 constellation
    and degrees-within-that-sign rather than a single 0-360 longitude, so
    the full longitude is reconstructed (constellation*30 + coordinates)
    before feeding it through the same dasavarga_from_long() math used for
    every other body — mirrors the exact pattern upstream's own
    bhaava_madhya() uses internally to combine Ascendant with dhasavarga()."""
    constellation, coordinates, _nak_no, _paadha_no = drik.ascendant(jd, p)
    lagna_longitude = constellation * 30 + coordinates
    varga_constellation, _long_in_raasi = drik.dasavarga_from_long(lagna_longitude, divisional_chart_factor)
    return varga_constellation

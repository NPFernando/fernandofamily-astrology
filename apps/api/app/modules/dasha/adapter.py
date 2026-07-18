"""Sole boundary permitted to import vendored `jhora` for this module — thin
pass-throughs only, no enums, no business logic.
"""
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

from jhora import const  # noqa: E402
from jhora.horoscope.dhasa.graha import vimsottari  # noqa: E402
from jhora.panchanga import drik  # noqa: E402

configure_ayanamsa(drik)


def ensure_ayanamsa() -> None:
    """Call at the top of every calculator entry point — see
    configure_ayanamsa's docstring for why the import-time call above isn't
    sufficient on its own."""
    configure_ayanamsa(drik)


def mahadasha_periods(jd: float, p) -> tuple[tuple, list]:
    """(vim_balance, periods) at MAHA_DHASA_ONLY depth -- 9 entries, one per
    planet, covering the full ~120-year Vimshottari cycle from birth. Each
    period entry is (lords_tuple, (Y, M, D, fractional_hour), duration_years).
    v1 scope: no Antardasha/Bhukti nesting (see ANTARA-depth engine coverage
    in tests/test_vendor_dasha_engine.py for that, not yet exposed here)."""
    return vimsottari.get_vimsottari_dhasa_bhukthi(
        jd, p, dhasa_level_index=const.MAHA_DHASA_DEPTH.MAHA_DHASA_ONLY,
    )

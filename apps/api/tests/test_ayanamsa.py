"""Regression guard for the engine's configured ayanamsa (Lahiri).

Derivation and full cross-check across candidate modes:
scripts/dev/ayanamsa_newyear_check.py. Ground truth is the officially
published Sri Lankan New Year ("Aluth Avurudu") dawn instant — the exact
moment the Sun's sidereal longitude crosses 0 degrees (Mesha Sankranti) —
which is ayanamsa-SENSITIVE (unlike the Poya/tithi fixture in test_poya.py,
where the ayanamsa offset cancels out of a Moon-minus-Sun difference).

This test calls the real adapters' `ensure_ayanamsa()` (the same choke point
production request handlers use — see app/core/vendor_path.py) rather than
hardcoding a swisseph mode directly, so it fails if that configuration ever
silently regresses.
"""
from datetime import datetime, timedelta, timezone

import swisseph as swe
from fastapi.testclient import TestClient

from app.main import app
from app.modules.panchanga import adapter

COLOMBO_TZ = timezone(timedelta(hours=5, minutes=30))

# (published dawn instant, source) — see scripts/dev/ayanamsa_newyear_check.py
# for the Punya Kaalaya windows these midpoints are derived from.
PUBLISHED_NEW_YEAR_INSTANTS = [
    datetime(2024, 4, 13, 21, 5, tzinfo=COLOMBO_TZ),
    datetime(2025, 4, 14, 3, 21, tzinfo=COLOMBO_TZ),
    datetime(2026, 4, 14, 9, 32, tzinfo=COLOMBO_TZ),
]

# 0.05 degrees is ~3 arcminutes (~12 seconds of solar motion) — generous
# next to the sub-minute matches found, but tight enough that regressing to
# any other candidate ayanamsa (all >= ~140 minutes / ~2 degrees off, per the
# dev script's cross-check table) fails loudly.
_TOLERANCE_DEGREES = 0.05


def _wrapped_offset_from_aries(longitude_degrees: float) -> float:
    return longitude_degrees - 360 if longitude_degrees > 180 else longitude_degrees


def test_configured_ayanamsa_matches_sri_lankan_new_year_instants():
    adapter.ensure_ayanamsa()
    for published in PUBLISHED_NEW_YEAR_INSTANTS:
        utc = published.astimezone(timezone.utc)
        hour = utc.hour + utc.minute / 60 + utc.second / 3600
        jd_ut = swe.julday(utc.year, utc.month, utc.day, hour)
        longitude, _ = swe.calc_ut(jd_ut, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)
        offset = _wrapped_offset_from_aries(longitude[0])
        assert abs(offset) < _TOLERANCE_DEGREES, (
            f"at published New Year instant {published.isoformat()}, sidereal Sun "
            f"longitude was {longitude[0]:.4f} degrees from Aries (0) — expected "
            f"within {_TOLERANCE_DEGREES}; the configured ayanamsa may have regressed"
        )


def test_health_ready_survives_the_ayanamsa_override():
    """Regression guard for a real bug this fix introduced and then fixed:
    configure_ayanamsa's runtime override mutates the shared vendored `const`
    module's _DEFAULT_AYANAMSA_MODE attribute, which scripts/verify_vendor.py's
    vendor-internal drift check (used by this exact endpoint) otherwise flags
    as "Configuration Drift" against factory_settings.json's stale
    TRUE_PUSHYA entry — a false positive with no way to distinguish an
    intentional runtime override from an accidental vendor hand-edit. Caught
    via a CI e2e failure (the readiness check timing out), not by any
    existing test — nothing previously exercised /health/ready at all."""
    client = TestClient(app)
    response = client.get("/api/v1/health/ready")
    assert response.status_code == 200, response.text

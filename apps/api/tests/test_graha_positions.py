"""Graha positions + retrograde coverage.

Two real bugs in the pinned vendored engine (V4.8.7, commit ca22995) made
this harder than the catalog suggested:

1. `drik.planetary_positions()` crashes unconditionally — it calls
   `planet_list.index(planet)`, but `planet_list` is a module-level dict,
   which has no `.index()`. Reproduces on every call, not a calling-
   convention issue. Worked around by reimplementing the same intent with
   the underlying `sidereal_longitude()`/`ketu()` primitives directly (see
   adapter.graha_longitudes).
2. `drik.planets_in_stationary()` crashes on Ketu specifically under this
   app's actual runtime Rahu/Ketu-as-true-nodes configuration — it doesn't
   special-case Ketu's non-native swisseph representation the way
   `planets_in_retrograde()` correctly does. Stationary flags are therefore
   not offered at all (see adapter.retrograde_planet_ids's docstring).
"""
from fastapi.testclient import TestClient

from app.main import app
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.panchanga import adapter, repository

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def _daily(date_str: str) -> dict:
    response = client.post("/api/v1/panchanga/daily", json={"date": date_str, **COLOMBO})
    assert response.status_code == 200, response.text
    return response.json()


def test_upstream_planetary_positions_is_confirmed_broken():
    """Documents the actual bug this feature had to work around, so a
    future vendor upgrade that fixes it doesn't leave this comment stale
    without anyone noticing. If this test ever fails (no exception raised),
    the workaround in adapter.graha_longitudes may no longer be necessary."""
    from jhora.panchanga import drik

    pp_adapter.ensure_ayanamsa()
    place = pp_adapter.place("Colombo", COLOMBO["latitude"], COLOMBO["longitude"], 5.5)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2026, 7, 16), (12, 0, 0))
    try:
        drik.planetary_positions(jd, place)
    except AttributeError as exc:
        assert "index" in str(exc)
    else:
        raise AssertionError(
            "drik.planetary_positions() no longer crashes — "
            "adapter.graha_longitudes' workaround docstring may need updating"
        )


def test_graha_longitudes_matches_sidereal_longitude_directly():
    pp_adapter.ensure_ayanamsa()
    place = pp_adapter.place("Colombo", COLOMBO["latitude"], COLOMBO["longitude"], 5.5)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2026, 7, 16), (12, 0, 0))

    positions = adapter.graha_longitudes(jd, place)
    assert len(positions) == 9
    assert sorted(planet_id for planet_id, _ in positions) == list(range(9))

    from jhora import const
    from jhora.panchanga import drik

    jd_ut = jd - 5.5 / 24.0
    for planet_id, longitude in positions:
        if repository.GRAHA_KEYS[planet_id] == "ketu":
            expected = drik.ketu(drik.sidereal_longitude(jd_ut, const._RAHU))
        else:
            planet_const = next(pc for pc, pid in drik.planet_list.items() if pid == planet_id)
            expected = drik.sidereal_longitude(jd_ut, planet_const)
        assert abs(longitude - expected) < 1e-6


def test_daily_panchanga_includes_9_graha_positions_with_valid_ranges():
    body = _daily("2026-07-16")
    positions = body["graha_positions"]
    assert len(positions) == 9
    assert [p["key"] for p in positions] == repository.GRAHA_KEYS
    for p in positions:
        assert 1 <= p["rashi_index"] <= 12
        assert p["rashi_key"] == repository.RASHI_KEYS[p["rashi_index"] - 1]
        assert 1 <= p["nakshatra_index"] <= 27
        assert 0 <= p["longitude_degrees"] < 360


def test_sun_and_moon_are_never_retrograde():
    body = _daily("2026-07-16")
    by_key = {p["key"]: p for p in body["graha_positions"]}
    assert by_key["sun"]["is_retrograde"] is False
    assert by_key["moon"]["is_retrograde"] is False


def test_ketu_retrograde_status_mirrors_rahu():
    # Rahu/Ketu are lunar nodes and move together (opposite points on the
    # same orbit) — their retrograde status should always match.
    body = _daily("2026-07-16")
    by_key = {p["key"]: p for p in body["graha_positions"]}
    assert by_key["rahu"]["is_retrograde"] == by_key["ketu"]["is_retrograde"]

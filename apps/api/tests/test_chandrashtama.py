"""Chandrashtama alert coverage.

Golden-value check against the vendored engine directly (same pattern as
test_tara_bala.py), plus a check that only Method A (birth date/time)
populates chandrashtama — Methods B (known nakshatra+paksha) and C (direct
bird) have no way to unambiguously resolve a natal Moon rashi (see
calculator.compute_chandrashtama's docstring) and must stay null.
"""
from fastapi.testclient import TestClient

from app.main import app
from app.modules.pancha_pakshi import adapter, calculator

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}

# 1996-12-07 10:34 Colombo has natal Moon rashi 7; independently confirmed
# (via a direct day-by-day sweep of adapter.chandrashtama_today) to match
# the day's afflicted rashi on 2026-07-11 and 2026-07-12, and not on the
# days immediately before/after.
_BIRTH = {"birth_date": "1996-12-07", "birth_time": "10:34:00"}


def _schedule(body: dict) -> dict:
    response = client.post("/api/v1/pancha-pakshi/schedule", json={**COLOMBO, **body})
    assert response.status_code == 200, response.text
    return response.json()


def test_compute_chandrashtama_matches_vendored_engine_directly():
    adapter.ensure_ayanamsa()
    place = adapter.place("Colombo", COLOMBO["latitude"], COLOMBO["longitude"], 5.5)
    jd = adapter.julian_day_number(adapter.date(2026, 7, 11), (12, 0, 0))

    afflicted_rasi, end_jd = adapter.chandrashtama_today(jd, place)
    start_jd = adapter.previous_moon_rashi_entry_jd(jd, place)
    assert start_jd < jd < end_jd, "the probe date should fall inside the window it computed"

    result = calculator.compute_chandrashtama(afflicted_rasi, jd, place, 5.5)
    assert result is not None
    assert result.starts_at.timestamp() < result.ends_at.timestamp()

    # A rashi other than the currently-afflicted one must yield None.
    other_rashi = afflicted_rasi % 12 + 1
    assert calculator.compute_chandrashtama(other_rashi, jd, place, 5.5) is None


def test_method_birth_datetime_populates_chandrashtama_during_the_window():
    on_window = _schedule({"method": "birth_datetime", **_BIRTH, "target_date": "2026-07-11", "target_time": "12:00:00"})
    assert on_window["chandrashtama"] is not None
    assert on_window["chandrashtama"]["starts_at"] < on_window["chandrashtama"]["ends_at"]

    outside_window = _schedule({"method": "birth_datetime", **_BIRTH, "target_date": "2026-07-16", "target_time": "12:00:00"})
    assert outside_window["chandrashtama"] is None


def test_method_nakshatra_paksha_leaves_chandrashtama_null():
    body = _schedule(
        {
            "method": "nakshatra_paksha",
            "nakshatra_index": 5,
            "paksha": "waxing",
            "target_date": "2026-07-11",
            "target_time": "12:00:00",
        }
    )
    assert body["chandrashtama"] is None


def test_method_direct_bird_leaves_chandrashtama_null():
    body = _schedule(
        {
            "method": "bird",
            "bird": "vulture",
            "target_date": "2026-07-11",
            "target_time": "12:00:00",
        }
    )
    assert body["chandrashtama"] is None

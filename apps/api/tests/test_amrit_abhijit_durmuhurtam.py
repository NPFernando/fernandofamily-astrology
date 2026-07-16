"""Amrit Kaalam, Abhijit Muhurta, Durmuhurtam coverage.

These three share plumbing with Choghadiya/Hora (test_choghadiya_hora.py):
Amrit Kaalam is a filtered view of Choghadiya (key == "amrit"), computed the
same way upstream's own amrit_kaalam() derives it internally — not a
separate engine call. Abhijit Muhurta and Durmuhurtam are simple
start/end-pair parses in the same shape as the existing kalams.
"""
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_rate_limit_buckets():
    # This file alone makes ~25 requests across a full week x several tests —
    # enough to trip the shared 40/window budget (app/core/rate_limit.py)
    # when combined with other test files' own requests in the same pytest
    # session, since only test_rate_limit.py itself resets this otherwise
    # global state. Same pattern as that file's _clean_buckets fixture.
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}

# Weekday -> expected durmuhurtam window count (Sun/Wed/Sat: 1, else: 2).
_EXPECTED_DURMUHURTAM_COUNT = {
    "2026-07-12": 1,  # Sunday
    "2026-07-13": 2,  # Monday
    "2026-07-14": 2,  # Tuesday
    "2026-07-15": 1,  # Wednesday
    "2026-07-16": 2,  # Thursday
    "2026-07-17": 2,  # Friday
    "2026-07-18": 1,  # Saturday
}


def _daily(date_str: str) -> dict:
    response = client.post("/api/v1/panchanga/daily", json={"date": date_str, **COLOMBO})
    assert response.status_code == 200, response.text
    return response.json()


def test_amrit_kaalam_matches_amrit_choghadiya_segments():
    body = _daily("2026-07-16")
    amrit_segments = [span for span in body["choghadiya"] if span["key"] == "amrit"]
    assert len(body["amrit_kaalam"]) == len(amrit_segments) > 0
    for window, segment in zip(body["amrit_kaalam"], amrit_segments):
        assert window["starts_at"] == segment["starts_at"]
        assert window["ends_at"] == segment["ends_at"]


def test_amrit_kaalam_can_cross_midnight_consistently_with_choghadiya():
    # 2026-07-18 (Saturday) has an amrit segment starting in the evening and
    # ending after midnight — verified directly against the vendored engine.
    body = _daily("2026-07-18")
    last = body["amrit_kaalam"][-1]
    start = datetime.fromisoformat(last["starts_at"])
    end = datetime.fromisoformat(last["ends_at"])
    assert end > start
    assert end.date() > start.date()


def test_abhijit_muhurta_is_always_present_near_midday():
    for date_str in _EXPECTED_DURMUHURTAM_COUNT:
        body = _daily(date_str)
        start = datetime.fromisoformat(body["abhijit_muhurta"]["starts_at"])
        end = datetime.fromisoformat(body["abhijit_muhurta"]["ends_at"])
        assert end > start
        assert 10 <= start.hour <= 13, f"{date_str}: abhijit muhurta should be near midday, got {start}"


def test_durmuhurtam_window_count_matches_weekday_rule_across_a_full_week():
    for date_str, expected_count in _EXPECTED_DURMUHURTAM_COUNT.items():
        body = _daily(date_str)
        windows = body["durmuhurtam"]
        assert len(windows) == expected_count, (
            f"{date_str} ({body['weekday']}): expected {expected_count} durmuhurtam window(s), got {len(windows)}"
        )
        for window in windows:
            start = datetime.fromisoformat(window["starts_at"])
            end = datetime.fromisoformat(window["ends_at"])
            assert end > start
            assert start.date() == end.date(), "durmuhurtam should never cross midnight"

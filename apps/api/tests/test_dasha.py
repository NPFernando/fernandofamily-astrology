"""Vimshottari Dasha timeline: 9 Mahadashas, each with 9 nested Antardashas.

Golden-value comparisons split by sensitivity, same shape as
test_birth_chart.py and for the same underlying reason (see
app.core.vendor_path.configure_ayanamsa's docstring and
test_vendor_dasha_engine.py's module docstring): going through an actual
API request (vs. a same-thread direct call) reproducibly shifts a Moon-
longitude-derived sub-day balance by a few arcseconds' worth of time,
which can occasionally cross a midnight boundary and shift a start/end
date by a day. Lord sequence and duration_years are nakshatra-index /
whole-year dict lookups, not longitude-derived, so those are compared
exactly; start_date/end_date use a loose day-level tolerance.
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.core.vendor_path import configure_ayanamsa
from app.main import app
from app.modules.dasha import adapter as dasha_adapter
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.panchanga import repository as panchanga_repository
from jhora.panchanga import drik

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_rate_limit_buckets():
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


COLOMBO_BIRTH = {
    "birth_date": "2000-01-01",
    "birth_time": "12:00:00",
    "location_name": "Colombo, Sri Lanka",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def _assert_date_close(actual_iso: str, expected: date, max_days: int = 1):
    actual = date.fromisoformat(actual_iso)
    assert abs((actual - expected).days) <= max_days, (actual_iso, expected)


def test_dasha_matches_vendored_engine_directly():
    response = client.post("/api/v1/dasha/mahadasha", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()

    configure_ayanamsa(drik)
    place = pp_adapter.place("Colombo, Sri Lanka", 6.9271, 79.8612, 6.0)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2000, 1, 1), (12, 0, 0))

    _vim_balance, raw_periods = dasha_adapter.mahadasha_periods(jd, place)
    assert len(data["periods"]) == 9
    assert len(raw_periods) == 9

    expected_start_dates = [date(y, m, d) for _lords, (y, m, d, _fh), _dur in raw_periods]

    for i, period in enumerate(data["periods"]):
        expected_lord = raw_periods[i][0][0]
        expected_duration = round(raw_periods[i][2])
        assert period["key"] == panchanga_repository.GRAHA_KEYS[expected_lord]
        assert period["duration_years"] == expected_duration
        _assert_date_close(period["start_date"], expected_start_dates[i])
        if i + 1 < 9:
            _assert_date_close(period["end_date"], expected_start_dates[i + 1])

    # Antardasha level: same comparison against a direct ANTARA-depth engine
    # call — lord sequence exact, start dates ±1 day (same arcsec rationale).
    _vim_balance2, raw_antara_rows = dasha_adapter.antardasha_periods(jd, place)
    assert len(raw_antara_rows) == 81
    flat_antardashas = [a for p in data["periods"] for a in p["antardashas"]]
    assert len(flat_antardashas) == 81
    for antara, ((_maha_lord, antara_lord), (y, m, d, _fh), _dur) in zip(
        flat_antardashas, raw_antara_rows
    ):
        assert antara["key"] == panchanga_repository.GRAHA_KEYS[antara_lord]
        _assert_date_close(antara["start_date"], date(y, m, d))


def test_dasha_periods_are_chronological_and_cover_full_cycle():
    response = client.post("/api/v1/dasha/mahadasha", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    periods = response.json()["periods"]

    assert len(periods) == 9
    assert {p["key"] for p in periods} == set(panchanga_repository.GRAHA_KEYS)

    for i in range(len(periods) - 1):
        assert periods[i]["end_date"] == periods[i + 1]["start_date"]
        assert date.fromisoformat(periods[i]["start_date"]) < date.fromisoformat(periods[i]["end_date"])

    total_years = sum(p["duration_years"] for p in periods)
    assert total_years == 120

    first_start = date.fromisoformat(periods[0]["start_date"])
    last_end = date.fromisoformat(periods[-1]["end_date"])
    assert abs((last_end - first_start).days - 120 * 365.2425) < 5

    # Antardasha nesting invariants: 9 per mahadasha, first lord is the maha
    # lord itself, all 9 planets appear exactly once, the sub-chain exactly
    # tiles its mahadasha, and the flat chain is contiguous across
    # mahadasha boundaries too.
    for p in periods:
        antaras = p["antardashas"]
        assert len(antaras) == 9
        assert antaras[0]["key"] == p["key"]
        assert {a["key"] for a in antaras} == set(panchanga_repository.GRAHA_KEYS)
        assert antaras[0]["start_date"] == p["start_date"]
        assert antaras[-1]["end_date"] == p["end_date"]
    flat = [a for p in periods for a in p["antardashas"]]
    for i in range(len(flat) - 1):
        assert flat[i]["end_date"] == flat[i + 1]["start_date"]
        assert date.fromisoformat(flat[i]["start_date"]) < date.fromisoformat(flat[i]["end_date"])


def test_dasha_rejects_invalid_timezone():
    response = client.post(
        "/api/v1/dasha/mahadasha",
        json={**COLOMBO_BIRTH, "iana_tz": "Not/AZone"},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_input"


def test_dasha_rejects_invalid_latitude():
    response = client.post(
        "/api/v1/dasha/mahadasha",
        json={**COLOMBO_BIRTH, "latitude": 999},
    )
    assert response.status_code == 422


def test_dasha_has_no_get_route():
    response = client.get("/api/v1/dasha/mahadasha?birth_date=2000-01-01&birth_time=12:00:00")
    assert response.status_code == 405

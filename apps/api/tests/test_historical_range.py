"""Historical/ancestor date range (1200-2399 CE since the 2026-07-20
widening — see validation.py's docstring for the semantics that come with
pre-1800 dates: proleptic-Gregorian input, LMT offsets from tzdb).
"""
import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.main import app
from app.modules.pancha_pakshi import validation

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_rate_limit_buckets():
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


ANCESTOR_BIRTH = {
    "birth_date": "1750-06-15",
    "birth_time": "06:00:00",
    "location_name": "Colombo, Sri Lanka",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def test_1750_birth_chart_computes_with_lmt_offset():
    """A pre-standard-time birth chart computes, and the location's UTC
    offset is the tzdb's Local Mean Time value for Colombo (+5:19:24 ->
    319 minutes after rounding), not the modern +5:30."""
    response = client.post("/api/v1/birth-chart/rasi", json=ANCESTOR_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["placements"]) == 9
    assert len(data["yogataras"]) == 27
    assert data["location"]["utc_offset_minutes"] == 319


def test_image_profile_accepts_1750_and_rejects_pre_1200(monkeypatch):
    monkeypatch.setattr(validation, "_IMAGE_PROFILE", True)

    response = client.post("/api/v1/birth-chart/rasi", json=ANCESTOR_BIRTH)
    assert response.status_code == 200, response.text

    response = client.post("/api/v1/birth-chart/rasi", json={**ANCESTOR_BIRTH, "birth_date": "1199-12-31"})
    assert response.status_code == 422
    assert "1200" in response.json()["message"]


def test_dasha_accepts_historical_birth(monkeypatch):
    """The gate is shared, but exercise one more module end-to-end: a 1750
    Vimshottari timeline still spans the full 120-year cycle."""
    monkeypatch.setattr(validation, "_IMAGE_PROFILE", True)
    response = client.post("/api/v1/dasha/mahadasha", json=ANCESTOR_BIRTH)
    assert response.status_code == 200, response.text
    periods = response.json()["periods"]
    assert len(periods) == 9
    assert sum(p["duration_years"] for p in periods) == 120


def test_divisional_charts_accepts_historical_birth(monkeypatch):
    """A third module on the same shared gate: Navamsa still computes for a
    pre-1800 birth."""
    monkeypatch.setattr(validation, "_IMAGE_PROFILE", True)
    response = client.post("/api/v1/divisional-charts/navamsa", json=ANCESTOR_BIRTH)
    assert response.status_code == 200, response.text
    assert len(response.json()["placements"]) == 9


def test_image_profile_rejects_upper_boundary(monkeypatch):
    """The lower bound (1200 CE) is well covered above; the upper bound
    (2399/2400 CE) was the one asymmetry in this feature's test coverage —
    2399-12-31 must still compute, and 2400-01-01 must still be rejected
    with the documented "outside the shipped ephemeris range" message,
    exactly as it was before the 1200 CE widening (only the lower bound
    moved)."""
    monkeypatch.setattr(validation, "_IMAGE_PROFILE", True)

    response = client.post("/api/v1/birth-chart/rasi", json={**ANCESTOR_BIRTH, "birth_date": "2399-12-31"})
    assert response.status_code == 200, response.text

    response = client.post("/api/v1/birth-chart/rasi", json={**ANCESTOR_BIRTH, "birth_date": "2400-01-01"})
    assert response.status_code == 422
    assert "2399" in response.json()["message"]

"""Eclipse & Grahan forecast (/api/v1/panchanga/eclipses) coverage.

Golden values are checked against real, independently-verifiable eclipses
(the September 7, 2025 total lunar eclipse and the August 2, 2027 total
solar eclipse — both widely reported, long-duration events), not just
against the vendored engine's own internal consistency, the same bar used
throughout this session for astronomy-adjacent features.
"""
import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_rate_limit_buckets():
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def _forecast(from_date: str) -> dict:
    response = client.post("/api/v1/panchanga/eclipses", json={"from_date": from_date, **COLOMBO})
    assert response.status_code == 200, response.text
    return response.json()


def test_next_solar_eclipse_from_mid_2026_is_the_august_2027_total():
    # Real event: total solar eclipse of 2027-08-02 (one of the longest
    # totalities of the century), only partially visible from Colombo
    # (outside the path of totality) — max eclipse ~17:02 local.
    body = _forecast("2026-07-16")
    solar = body["next_solar"]
    assert solar["max_at"].startswith("2027-08-02T17:0")
    assert solar["type"] == "partial"
    assert solar["is_visible"] is True
    assert 0.5 < solar["magnitude"] < 0.7
    assert solar["first_contact_at"] is not None
    assert solar["fourth_contact_at"] is not None
    assert solar["first_contact_at"] < solar["max_at"] < solar["fourth_contact_at"]


def test_next_lunar_eclipse_from_mid_2026_is_the_feb_2027_penumbral():
    body = _forecast("2026-07-16")
    lunar = body["next_lunar"]
    assert lunar["max_at"].startswith("2027-02-2")
    assert lunar["type"] == "penumbral"
    assert lunar["umbral_magnitude"] == 0.0
    assert lunar["totality_starts_at"] is None
    assert lunar["totality_ends_at"] is None
    assert lunar["partial_starts_at"] is None
    assert lunar["partial_ends_at"] is None


def test_next_lunar_eclipse_from_early_2025_is_the_september_total():
    # Real event: total lunar eclipse of 2025-09-07 ("blood moon"), widely
    # visible across Asia including Sri Lanka.
    body = _forecast("2025-01-01")
    lunar = body["next_lunar"]
    assert lunar["max_at"].startswith("2025-09-07") or lunar["max_at"].startswith("2025-09-08")
    assert lunar["type"] == "total"
    assert lunar["is_visible"] is True
    assert lunar["umbral_magnitude"] > 1.0
    assert lunar["begins_at"] is not None
    assert lunar["totality_starts_at"] is not None
    assert lunar["totality_ends_at"] is not None
    assert lunar["ends_at"] is not None
    assert (
        lunar["begins_at"]
        < lunar["partial_starts_at"]
        < lunar["totality_starts_at"]
        < lunar["max_at"]
        < lunar["totality_ends_at"]
        < lunar["partial_ends_at"]
        < lunar["ends_at"]
    )


def test_solar_fourth_contact_none_when_not_visible_from_location():
    # Real, previously-reproduced case: from Colombo, the 2041-04-30 partial
    # solar eclipse's first contact is visible but its fourth contact is not
    # (occurs after local sunset) — even though swisseph still returns a
    # nonzero geometric time for it. This is the regression test for the bit
    # -based gating in adapter.solar_contact_visible (a naive "tret value is
    # zero" check would incorrectly treat the fourth contact as available).
    body = _forecast("2040-01-01")
    solar = body["next_solar"]
    assert solar["max_at"].startswith("2041-04-30")
    assert solar["first_contact_at"] is not None
    assert solar["fourth_contact_at"] is None


def test_search_start_is_local_midnight_not_noon():
    # The 2027-02-21 penumbral lunar eclipse peaks at 04:42 local — before
    # noon. Requesting from_date on that same day must still find it (search
    # starts at local midnight); a noon-anchored search would already be
    # past its maximum and would incorrectly skip to the following eclipse
    # (2027-07-18).
    same_day = _forecast("2027-02-21")
    assert same_day["next_lunar"]["max_at"].startswith("2027-02-21T04:4")
    next_day = _forecast("2027-02-22")
    assert next_day["next_lunar"]["max_at"].startswith("2027-07-18")


def test_invalid_location_rejected():
    response = client.post(
        "/api/v1/panchanga/eclipses",
        json={"from_date": "2026-07-16", "location_name": "Nowhere", "latitude": 999, "longitude": 79.8612, "iana_tz": "Asia/Colombo"},
    )
    assert response.status_code == 422


def test_response_metadata_matches_request():
    body = _forecast("2026-07-16")
    assert body["from_date"] == "2026-07-16"
    assert body["location"]["name"] == "Colombo"
    assert "engine" in body

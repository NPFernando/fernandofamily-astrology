from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.main import app

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


@pytest.fixture(autouse=True)
def _clean_rate_limit_buckets():
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


def _search(**overrides) -> dict:
    body = {
        "method": "bird",
        "bird": "peacock",
        "from_date": "2026-07-16",
        "days": 3,
        "purpose": "general",
        "min_effect": "good",
        "min_duration_seconds": 900,
        **COLOMBO,
        **overrides,
    }
    response = client.post("/api/v1/muhurta/search", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def _overlaps(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return max(datetime.fromisoformat(a_start), datetime.fromisoformat(b_start)) < min(
        datetime.fromisoformat(a_end), datetime.fromisoformat(b_end)
    )


def test_muhurta_search_returns_ranked_windows_and_daily_summaries():
    body = _search()
    assert body["from_date"] == "2026-07-16"
    assert body["days"] == 3
    assert body["purpose"] == "general"
    assert body["birth_bird"] == "peacock"
    assert len(body["per_day"]) == 3
    assert body["windows"]
    assert body["windows"][0]["score"] >= body["windows"][-1]["score"]
    assert {"source_overlaps", "reasons"} <= set(body["windows"][0].keys())
    assert "pancha_pakshi" in body["windows"][0]["reasons"]


def test_muhurta_windows_do_not_overlap_avoid_periods():
    result = _search(days=1, min_duration_seconds=60)
    panchanga_response = client.post(
        "/api/v1/panchanga/daily",
        json={"date": "2026-07-16", **COLOMBO},
    )
    assert panchanga_response.status_code == 200, panchanga_response.text
    panchanga = panchanga_response.json()
    avoid_ranges = [
        panchanga["kalams"]["rahu"],
        panchanga["kalams"]["yamaganda"],
        panchanga["kalams"]["gulika"],
        *panchanga["durmuhurtam"],
    ]
    for window in result["windows"]:
        for avoid in avoid_ranges:
            assert not _overlaps(window["starts_at"], window["ends_at"], avoid["starts_at"], avoid["ends_at"])


def test_muhurta_purchase_purpose_filters_to_purchase_activities():
    body = _search(purpose="purchase", days=2)
    assert body["windows"]
    assert {w["pancha_pakshi_activity"] for w in body["windows"]} <= {"eating", "ruling"}


def test_muhurta_travel_adds_disha_shool_caution():
    body = _search(purpose="travel", days=1)
    assert body["windows"]
    assert any(c["key"] == "disha_shool" and c["value"] for c in body["windows"][0]["cautions"])


def test_muhurta_accepts_nakshatra_paksha_without_birth_details():
    body = _search(method="nakshatra_paksha", nakshatra_index=4, paksha="waxing")
    assert body["birth_bird"] in {"vulture", "owl", "crow", "cock", "peacock"}


def test_muhurta_rejects_invalid_location():
    response = client.post(
        "/api/v1/muhurta/search",
        json={
            "method": "bird",
            "bird": "peacock",
            "from_date": "2026-07-16",
            "latitude": 999,
            "longitude": 79.8612,
            "location_name": "Nowhere",
            "iana_tz": "Asia/Colombo",
        },
    )
    assert response.status_code == 422

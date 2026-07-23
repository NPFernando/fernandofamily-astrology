"""HTTP-level coverage for the three pancha-pakshi routes that had none:
/current, /birth-bird, /metadata. The calculators underneath (schedule
resolution, current/next period selection) are already thoroughly unit- and
golden-tested elsewhere (test_current_period_selection.py, test_windows.py,
test_summary.py); this file exercises the routes themselves — request
validation, response shape, and the field-mapping between the calculator's
output and each route's own response — which none of those cover.
"""
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

BIRTH_DATETIME_BODY = {
    "method": "birth_datetime",
    "birth_date": "2000-01-01",
    "birth_time": "12:00:00",
    "target_date": "2026-07-12",
    "target_time": "12:00:00",
    **COLOMBO,
}


def setup_function():
    rate_limit._hits.clear()


def test_current_returns_current_and_next_period_for_the_given_as_of_moment():
    body = {**BIRTH_DATETIME_BODY, "as_of_date": "2026-07-12", "as_of_time": "12:00:00"}
    response = client.post("/api/v1/pancha-pakshi/current", json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    assert set(data.keys()) == {"current_period", "next_period"}
    assert data["current_period"] is not None
    # A sub-period has these fields per the shared SubPeriod model.
    for key in ("starts_at", "ends_at", "effect", "sub_bird", "sub_activity"):
        assert key in data["current_period"]
    assert data["next_period"] is not None
    assert data["next_period"]["starts_at"] > data["current_period"]["starts_at"]


def test_current_matches_schedule_selection_for_the_same_as_of_moment():
    """Cross-check against /schedule rather than a hardcoded expected period:
    /current's calculator (select_current_and_next) is the same one
    /schedule uses internally when as_of_date/as_of_time are supplied — the
    two routes must agree."""
    body = {**BIRTH_DATETIME_BODY, "as_of_date": "2026-07-12", "as_of_time": "15:00:00"}

    current_response = client.post("/api/v1/pancha-pakshi/current", json=body)
    schedule_response = client.post("/api/v1/pancha-pakshi/schedule", json=body)
    assert current_response.status_code == 200, current_response.text
    assert schedule_response.status_code == 200, schedule_response.text

    assert current_response.json()["current_period"] == schedule_response.json()["current_period"]
    assert current_response.json()["next_period"] == schedule_response.json()["next_period"]


def test_current_rejects_invalid_body():
    response = client.post("/api/v1/pancha-pakshi/current", json={})
    assert response.status_code == 422


def test_birth_bird_returns_the_resolved_bird_and_lords():
    response = client.post("/api/v1/pancha-pakshi/birth-bird", json=BIRTH_DATETIME_BODY)
    assert response.status_code == 200, response.text
    data = response.json()
    assert set(data.keys()) == {"birth_bird", "padu_pakshi", "bharana_pakshi"}
    assert data["birth_bird"] in ("vulture", "owl", "crow", "cock", "peacock")


def test_birth_bird_matches_schedule_for_the_same_birth_info():
    """/birth-bird is meant to be a lightweight subset of /schedule's own
    birth_bird/padu_pakshi/bharana_pakshi fields for the same request — they
    must agree exactly."""
    birth_bird_response = client.post("/api/v1/pancha-pakshi/birth-bird", json=BIRTH_DATETIME_BODY)
    schedule_response = client.post("/api/v1/pancha-pakshi/schedule", json=BIRTH_DATETIME_BODY)
    assert birth_bird_response.status_code == 200, birth_bird_response.text
    assert schedule_response.status_code == 200, schedule_response.text

    bb = birth_bird_response.json()
    sched = schedule_response.json()
    assert bb["birth_bird"] == sched["birth_bird"]
    assert bb["padu_pakshi"] == sched["padu_pakshi"]
    assert bb["bharana_pakshi"] == sched["bharana_pakshi"]


def test_birth_bird_rejects_direct_bird_selection_method():
    """The "bird" method is deliberately excluded from BirthBirdRequest's
    discriminated union — there is nothing to resolve when the bird is
    already given directly."""
    response = client.post(
        "/api/v1/pancha-pakshi/birth-bird",
        json={"method": "bird", "bird": "peacock", "target_date": "2026-07-12", "target_time": "12:00:00", **COLOMBO},
    )
    assert response.status_code == 422


def test_metadata_returns_engine_fields_and_cache_header():
    response = client.get("/api/v1/pancha-pakshi/metadata")
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "public, max-age=300"
    data = response.json()
    for key in ("version", "commit", "csv_checksum", "ephemeris_manifest_checksum", "deployed_commit"):
        assert key in data

    # Same cached EngineMetadata every schedule response embeds — the route
    # must not be a separate, potentially-drifting computation.
    schedule_response = client.post("/api/v1/pancha-pakshi/schedule", json=BIRTH_DATETIME_BODY)
    assert data == schedule_response.json()["engine"]

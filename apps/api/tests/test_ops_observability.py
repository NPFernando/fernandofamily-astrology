from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.core.metrics import reset_metrics_for_tests
from app.main import app


@pytest.fixture(autouse=True)
def _clean_metrics():
    reset_metrics_for_tests()
    yield
    reset_metrics_for_tests()


def _loopback_client() -> TestClient:
    return TestClient(app, client=("127.0.0.1", 50000))


def test_request_id_header_on_success_and_validation_error():
    client = _loopback_client()

    success = client.get("/api/v1/health/live")
    assert success.status_code == 200
    UUID(success.headers["x-request-id"])

    invalid = client.post("/api/v1/pancha-pakshi/schedule", json={})
    assert invalid.status_code == 422
    UUID(invalid.headers["x-request-id"])


def test_metrics_endpoint_allows_loopback_scrape():
    client = _loopback_client()
    client.get("/api/v1/health/live")

    response = client.get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "astrology_api_build_info" in response.text
    assert (
        'astrology_api_requests_total{method="GET",path="/api/v1/health/live",status_code="200"} 1'
        in response.text
    )
    assert 'astrology_api_request_duration_seconds_bucket{method="GET",path="/api/v1/health/live",' in response.text


def test_metrics_endpoint_rejects_public_forwarded_client():
    client = _loopback_client()

    response = client.get("/metrics", headers={"x-forwarded-for": "8.8.8.8"})

    assert response.status_code == 403


def test_metrics_use_route_templates_and_do_not_expose_query_or_body_values():
    client = _loopback_client()
    distinctive = "1911-11-11"
    client.get(f"/api/v1/health/live?birth_date={distinctive}")
    schedule = client.post(
        "/api/v1/pancha-pakshi/schedule",
        json={
            "method": "birth_datetime",
            "birth_date": distinctive,
            "birth_time": "10:34:00",
            "target_date": "2026-07-11",
            "target_time": "12:00:00",
            "location_name": "Colombo, Sri Lanka",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "iana_tz": "Asia/Colombo",
        },
    )
    assert schedule.status_code == 200

    metrics = client.get("/metrics").text

    assert "/api/v1/health/live" in metrics
    assert "/api/v1/pancha-pakshi/schedule" in metrics
    assert distinctive not in metrics
    assert "Colombo" not in metrics
    assert "6.9271" not in metrics

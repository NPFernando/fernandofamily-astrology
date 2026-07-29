from fastapi.testclient import TestClient

from app.core import rate_limit
from app.main import app

client = TestClient(app)

COLOMBO_BIRTH = {
    "birth_date": "2000-01-01",
    "birth_time": "12:00:00",
    "location_name": "Colombo, Sri Lanka",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def setup_function():
    rate_limit._hits.clear()


def test_ashtakavarga_returns_all_houses_and_classical_total():
    response = client.post("/api/v1/ashtakavarga/calculate", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_points"] == 337
    assert len(data["sarvashtakavarga"]) == 12
    assert sum(house["points"] for house in data["sarvashtakavarga"]) == 337
    assert [house["rashi_index"] for house in data["sarvashtakavarga"]] == list(range(1, 13))


def test_ashtakavarga_rejects_invalid_timezone_and_has_no_get_birth_route():
    invalid = client.post("/api/v1/ashtakavarga/calculate", json={**COLOMBO_BIRTH, "iana_tz": "Not/AZone"})
    assert invalid.status_code == 422
    assert client.get("/api/v1/ashtakavarga/calculate?birth_date=2000-01-01").status_code == 405

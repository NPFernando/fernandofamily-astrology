from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_compatibility_fixed_friend_pair():
    res = client.post("/api/v1/compatibility/birds", json={"bird_a": "vulture", "bird_b": "peacock"})
    assert res.status_code == 200
    data = res.json()
    assert data["relation"] == "friend"
    assert data["context_dependent"] is False
    assert data["sample_size"] == 280
    assert data["variants"] == [{"relation": "friend", "count": 280}]


def test_compatibility_same_bird():
    res = client.post("/api/v1/compatibility/birds", json={"bird_a": "crow", "bird_b": "crow"})
    assert res.status_code == 200
    data = res.json()
    assert data["relation"] == "same"
    assert data["context_dependent"] is False
    assert data["sample_size"] == 140


def test_compatibility_context_dependent_pair_is_order_insensitive():
    forward = client.post("/api/v1/compatibility/birds", json={"bird_a": "vulture", "bird_b": "owl"})
    reverse = client.post("/api/v1/compatibility/birds", json={"bird_a": "owl", "bird_b": "vulture"})
    assert forward.status_code == 200
    assert reverse.status_code == 200
    assert forward.json()["relation"] == "friend"
    assert forward.json()["context_dependent"] is True
    assert forward.json()["sample_size"] == 280
    assert forward.json()["variants"] == [
        {"relation": "enemy", "count": 70},
        {"relation": "friend", "count": 210},
    ]
    assert reverse.json()["relation"] == forward.json()["relation"]
    assert reverse.json()["variants"] == forward.json()["variants"]


def test_compatibility_invalid_bird_rejected():
    res = client.post("/api/v1/compatibility/birds", json={"bird_a": "vulture", "bird_b": "swan"})
    assert res.status_code == 422


def test_vivaha_chakra_colombo_fixture():
    res = client.post(
        "/api/v1/compatibility/vivaha-chakra",
        json={
            "date": "2026-07-17",
            "time": "09:00:00",
            "location_name": "Colombo, Sri Lanka",
            "latitude": 6.9271,
            "longitude": 79.8612,
            "iana_tz": "Asia/Colombo",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["verdict_index"] == 2
    assert data["verdict_key"] == "wealthy_blessed"
    assert data["tone"] == "supportive"
    assert data["sun_nakshatra"] == {"key": "punarvasu", "index": 7, "pada": 4}
    assert data["moon_nakshatra"] == {"key": "magha", "index": 10, "pada": 4}
    assert data["location"]["utc_offset_minutes"] == 330


def test_vivaha_chakra_invalid_payload_rejected():
    res = client.post(
        "/api/v1/compatibility/vivaha-chakra",
        json={
            "date": "2026-07-17",
            "time": "09:00:00",
            "location_name": "Bad",
            "latitude": 999,
            "longitude": 79.8612,
            "iana_tz": "Asia/Colombo",
        },
    )
    assert res.status_code == 422


def test_platform_metadata_lists_compatibility():
    res = client.get("/api/v1/metadata")
    assert res.status_code == 200
    features = {item["id"] for item in res.json()["features"] if item["enabled"] and item["public"]}
    assert "compatibility" in features

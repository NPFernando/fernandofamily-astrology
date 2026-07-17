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
    # pada 3, not 4 — this fixture was captured against a since-fixed bug
    # (vivaha_chakra() passed local-embedded jd straight into
    # sidereal_longitude() instead of converting to UT first). Independently
    # cross-checked via nakshatra-span arithmetic on the Moon's sidereal
    # longitude at this exact moment: 127.755 degrees -> nakshatra 10 (magha),
    # pada 3.
    assert data["moon_nakshatra"] == {"key": "magha", "index": 10, "pada": 3}
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


def test_vivaha_chakra_matches_ut_corrected_verdict_not_local_jd_bug():
    # Regression test for the vendored-engine UT-conversion bug found during
    # code review: drik.vivaha_chakra_palan() computes jd_utc but never uses
    # it, passing local-embedded jd straight into sidereal_longitude()
    # instead. Since Sri Lanka's offset is constant (+5:30) across every
    # request this app makes, this was a systematic bias, not an edge case —
    # confirmed via direct reproduction that ~10% of sampled dates produced a
    # completely different (sometimes opposite-polarity) verdict. These two
    # real dates flip between "family_damage"/caution and
    # "wonderful_blessed"/supportive depending on whether the UT conversion
    # is applied; assert the app returns the astronomically correct one.
    colombo = {
        "location_name": "Colombo",
        "latitude": 6.9271,
        "longitude": 79.8612,
        "iana_tz": "Asia/Colombo",
    }
    res_a = client.post(
        "/api/v1/compatibility/vivaha-chakra",
        json={"date": "2026-01-20", "time": "12:00:00", **colombo},
    )
    assert res_a.status_code == 200
    assert res_a.json()["verdict_key"] == "family_damage"
    assert res_a.json()["tone"] == "caution"

    res_b = client.post(
        "/api/v1/compatibility/vivaha-chakra",
        json={"date": "2026-04-16", "time": "12:00:00", **colombo},
    )
    assert res_b.status_code == 200
    assert res_b.json()["verdict_key"] == "wonderful_blessed"
    assert res_b.json()["tone"] == "supportive"


def test_platform_metadata_lists_compatibility():
    res = client.get("/api/v1/metadata")
    assert res.status_code == 200
    features = {item["id"] for item in res.json()["features"] if item["enabled"] and item["public"]}
    assert "compatibility" in features

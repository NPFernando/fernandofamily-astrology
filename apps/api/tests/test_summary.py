from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def _summary_body(**overrides):
    body = {
        "method": "bird",
        "bird": "peacock",
        "target_date": "2026-07-12",
        "target_time": "12:00:00",
        **COLOMBO,
        "days": 3,
        "min_effect": "good",
    }
    body.update(overrides)
    return body


def test_summary_shape_and_length():
    res = client.post("/api/v1/pancha-pakshi/summary", json=_summary_body(days=5))
    assert res.status_code == 200
    data = res.json()
    assert data["birth_bird"] == "peacock"
    assert data["days"] == 5
    assert len(data["per_day"]) == 5
    dates = [d["date"] for d in data["per_day"]]
    assert dates == sorted(dates)
    for day in data["per_day"]:
        assert day["window_count"] >= 0
        assert day["good_seconds"] >= 0
        assert day["very_good_seconds"] >= 0
        assert day["best_effect"] in ("good", "very_good", None)


def test_summary_days_cap():
    res = client.post("/api/v1/pancha-pakshi/summary", json=_summary_body(days=32))
    assert res.status_code == 422
    res = client.post("/api/v1/pancha-pakshi/summary", json=_summary_body(days=31))
    assert res.status_code == 200
    assert len(res.json()["per_day"]) == 31


def test_summary_aggregates_match_windows():
    body = _summary_body(days=3)
    summary = client.post("/api/v1/pancha-pakshi/summary", json=body).json()
    windows = client.post("/api/v1/pancha-pakshi/windows", json=body).json()

    # Rebuild per-day aggregates from the raw windows and compare.
    by_date: dict[str, dict[str, int]] = {}
    for w in windows["windows"]:
        agg = by_date.setdefault(
            w["effective_date"], {"count": 0, "good": 0, "very_good": 0}
        )
        agg["count"] += 1
        if w["effect"] == "good":
            agg["good"] += w["duration_seconds"]
        else:
            agg["very_good"] += w["duration_seconds"]

    for day in summary["per_day"]:
        expected = by_date.get(day["date"], {"count": 0, "good": 0, "very_good": 0})
        assert day["window_count"] == expected["count"]
        assert day["good_seconds"] == expected["good"]
        assert day["very_good_seconds"] == expected["very_good"]


def test_summary_best_effect_consistency():
    data = client.post("/api/v1/pancha-pakshi/summary", json=_summary_body(days=4)).json()
    for day in data["per_day"]:
        if day["very_good_seconds"] > 0:
            assert day["best_effect"] == "very_good"
        elif day["good_seconds"] > 0:
            assert day["best_effect"] == "good"
        else:
            assert day["best_effect"] is None

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def _windows_body(**overrides):
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


def test_windows_basic_shape():
    res = client.post("/api/v1/pancha-pakshi/windows", json=_windows_body())
    assert res.status_code == 200
    data = res.json()
    assert data["birth_bird"] == "peacock"
    assert data["from_date"] == "2026-07-12"
    assert data["days"] == 3
    assert len(data["windows"]) > 0
    for w in data["windows"]:
        assert w["effect"] in ("good", "very_good")
        assert w["effective_date"] >= "2026-07-12"


def test_windows_very_good_is_subset_of_good():
    good = client.post("/api/v1/pancha-pakshi/windows", json=_windows_body()).json()
    very_good = client.post(
        "/api/v1/pancha-pakshi/windows", json=_windows_body(min_effect="very_good")
    ).json()
    good_ids = {(w["effective_date"], w["id"]) for w in good["windows"]}
    very_good_ids = {(w["effective_date"], w["id"]) for w in very_good["windows"]}
    assert very_good_ids <= good_ids
    assert all(w["effect"] == "very_good" for w in very_good["windows"])
    assert len(very_good_ids) < len(good_ids)


def test_windows_chronological_across_days():
    data = client.post("/api/v1/pancha-pakshi/windows", json=_windows_body(days=5)).json()
    starts = [w["starts_at"] for w in data["windows"]]
    assert starts == sorted(starts)
    assert len({w["effective_date"] for w in data["windows"]}) == 5


def test_windows_days_cap_enforced():
    res = client.post("/api/v1/pancha-pakshi/windows", json=_windows_body(days=15))
    assert res.status_code == 422
    res = client.post("/api/v1/pancha-pakshi/windows", json=_windows_body(days=0))
    assert res.status_code == 422


def test_windows_kinds_filter():
    day_only = client.post(
        "/api/v1/pancha-pakshi/windows", json=_windows_body(kinds=["day"])
    ).json()
    assert len(day_only["windows"]) > 0
    assert all(w["kind"] == "day" for w in day_only["windows"])


def test_windows_first_day_matches_schedule():
    # Cross-check: day 1's windows must be exactly the schedule endpoint's own
    # good/very_good sub-periods for the same request.
    schedule = client.post(
        "/api/v1/pancha-pakshi/schedule",
        json={k: v for k, v in _windows_body().items() if k not in ("days", "min_effect")},
    ).json()
    expected_ids = [
        sp["id"]
        for major in schedule["major_periods"]
        for sp in major["sub_periods"]
        if sp["effect"] in ("good", "very_good")
    ]
    windows = client.post("/api/v1/pancha-pakshi/windows", json=_windows_body(days=1)).json()
    assert [w["id"] for w in windows["windows"]] == expected_ids

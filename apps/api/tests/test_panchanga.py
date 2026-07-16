from datetime import date as date_type
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from zoneinfo import ZoneInfo

from app.main import app
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.panchanga import adapter, repository

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}
NEW_YORK = {
    "location_name": "New York",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "iana_tz": "America/New_York",
}


def _daily(payload_location: dict, date_str: str):
    response = client.post("/api/v1/panchanga/daily", json={"date": date_str, **payload_location})
    assert response.status_code == 200, response.text
    return response.json()


def _month(payload_location: dict, year: int, month: int):
    response = client.post("/api/v1/panchanga/month", json={"year": year, "month": month, **payload_location})
    assert response.status_code == 200, response.text
    return response.json()


def _noon_jd_and_place(loc: dict, d: date_type, offset_hours: float):
    place = pp_adapter.place(loc["location_name"], loc["latitude"], loc["longitude"], offset_hours)
    jd = pp_adapter.julian_day_number(pp_adapter.date(d.year, d.month, d.day), (12, 0, 0))
    return jd, place


@pytest.mark.parametrize(
    ("loc", "date_str"),
    [
        (COLOMBO, "2026-07-14"),
        (NEW_YORK, "2026-03-08"),  # US spring-forward day (DST transition)
    ],
)
def test_golden_indices_match_vendored_engine(loc, date_str):
    body = _daily(loc, date_str)
    d = date_type.fromisoformat(date_str)
    # Resolve the offset exactly as the calculator does (at local noon of the
    # target date) — hardcoding the standard-time offset shifts the JD on DST
    # transition days and can flip an element right at a boundary.
    from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours

    offset_hours = resolve_utc_offset_hours(d, ZoneInfo(loc["iana_tz"]))
    jd, place = _noon_jd_and_place(loc, d, offset_hours)

    raw_tithi = adapter.tithi(jd, place)
    raw_nak = adapter.nakshatra(jd, place)
    raw_yoga = adapter.yogam(jd, place)
    raw_month = adapter.lunar_month(jd, place)

    assert body["tithi"][0]["index"] == int(raw_tithi[0])
    assert body["tithi"][0]["key"] == repository.TITHI_KEYS[int(raw_tithi[0]) - 1]
    assert body["nakshatra"][0]["index"] == int(raw_nak[0])
    assert body["nakshatra"][0]["pada"] == int(raw_nak[1])
    assert body["yoga"][0]["index"] == int(raw_yoga[0])
    # Upstream returns 0 (not 12) for Phalguna — confirmed empirically via
    # the Poya gazette fixture (every Madin/Phalguna Poya 2021-2026) and
    # normalized in calculator.py; the API's index is the normalized 1..12
    # value, not the raw one.
    expected_month_index = 12 if int(raw_month[0]) == 0 else int(raw_month[0])
    assert body["lunar_month"]["index"] == expected_month_index
    assert body["weekday"] == [
        "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
    ][pp_adapter.weekday_index_0based(jd, place)]


def test_known_fixture_values_colombo():
    # 2026-07-14, Colombo: independently verified — a Tuesday, amavasya at
    # sunrise (tithi 30, krishna/waning), punarvasu nakshatra, jyeshtha month.
    body = _daily(COLOMBO, "2026-07-14")
    assert body["weekday"] == "tuesday"
    assert body["paksha"] == "waning"
    assert body["tithi"][0] == {
        "key": "amavasya",
        "index": 30,
        "starts_at": body["tithi"][0]["starts_at"],
        "ends_at": body["tithi"][0]["ends_at"],
    }
    assert body["tithi"][1]["key"] == "shukla-pratipada"
    assert body["nakshatra"][0]["key"] == "punarvasu"
    assert body["lunar_month"]["key"] == "jyeshtha"
    # Tithi ends after midnight for the successor entry — next-day handling.
    assert body["tithi"][1]["ends_at"].startswith("2026-07-15")
    # The first tithi began the previous evening — negative-hours handling.
    assert body["tithi"][0]["starts_at"].startswith("2026-07-13")


def test_karana_60_to_11_mapping():
    assert repository.karana_key_for_index60(1) == "kimstughna"
    assert repository.karana_key_for_index60(58) == "shakuni"
    assert repository.karana_key_for_index60(59) == "chatushpada"
    assert repository.karana_key_for_index60(60) == "naga"
    # Movable cycle: 2..57 cycle through the seven in order.
    assert repository.karana_key_for_index60(2) == "bava"
    assert repository.karana_key_for_index60(8) == "vishti"
    assert repository.karana_key_for_index60(9) == "bava"
    assert repository.karana_key_for_index60(57) == "vishti"
    with pytest.raises(ValueError):
        repository.karana_key_for_index60(0)
    with pytest.raises(ValueError):
        repository.karana_key_for_index60(61)


def test_karana_spans_cover_day_and_match_engine_at_sunrise():
    body = _daily(COLOMBO, "2026-07-14")
    spans = body["karana"]
    assert len(spans) >= 2
    # The engine's own sunrise karana must be the first span.
    d = date_type(2026, 7, 14)
    jd, place = _noon_jd_and_place(COLOMBO, d, 5.5)
    engine_karana = adapter.karana(jd, place)
    assert spans[0]["index_60"] == int(engine_karana[0])
    assert spans[0]["key"] == repository.karana_key_for_index60(int(engine_karana[0]))
    # Contiguous, ordered, and consistent with the karana arithmetic.
    for earlier, later in zip(spans, spans[1:]):
        assert earlier["ends_at"] == later["starts_at"]
        assert (earlier["index_60"] % 60) + 1 == later["index_60"]


def test_kalams_within_day_and_correct_duration():
    body = _daily(COLOMBO, "2026-07-14")
    sunrise = datetime.fromisoformat(body["sunrise"])
    sunset = datetime.fromisoformat(body["sunset"])
    day_eighth = (sunset - sunrise) / 8
    for name in ("rahu", "yamaganda", "gulika"):
        kalam = body["kalams"][name]
        start = datetime.fromisoformat(kalam["starts_at"])
        end = datetime.fromisoformat(kalam["ends_at"])
        assert sunrise <= start < end <= sunset
        assert abs((end - start) - day_eighth) < timedelta(seconds=2)


def test_timestamps_are_iso_with_offset():
    body = _daily(COLOMBO, "2026-07-14")
    for value in (
        body["sunrise"], body["sunset"], body["tithi"][0]["ends_at"],
        body["kalams"]["rahu"]["starts_at"],
    ):
        parsed = datetime.fromisoformat(value)
        assert parsed.utcoffset() is not None
        assert parsed.utcoffset() == timedelta(hours=5, minutes=30)


def test_polar_latitude_rejected_with_controlled_error():
    response = client.post(
        "/api/v1/panchanga/daily",
        json={"date": "2026-07-14", "location_name": "North", "latitude": 85.0, "longitude": 0.0, "iana_tz": "UTC"},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "sunrise_unavailable"


def test_moon_rise_set_present_for_normal_latitudes():
    body = _daily(COLOMBO, "2026-07-14")
    assert body["moonrise"] is not None
    assert body["moonset"] is not None


@pytest.mark.parametrize(
    "payload",
    [
        {"date": "2026-07-14", "location_name": "X", "latitude": 91.0, "longitude": 0.0, "iana_tz": "UTC"},
        {"date": "2026-07-14", "location_name": "X", "latitude": 0.0, "longitude": 181.0, "iana_tz": "UTC"},
        {"date": "2026-07-14", "location_name": "X", "latitude": 0.0, "longitude": 0.0, "iana_tz": "Not/AZone"},
    ],
)
def test_invalid_inputs_rejected(payload):
    response = client.post("/api/v1/panchanga/daily", json=payload)
    assert response.status_code == 422


def test_image_profile_date_range(monkeypatch):
    # The range guard is read at import time by the validation module; patch
    # the flag it exposes rather than re-importing the world.
    from app.modules.pancha_pakshi import validation

    monkeypatch.setattr(validation, "_IMAGE_PROFILE", True)
    response = client.post("/api/v1/panchanga/daily", json={"date": "1750-06-15", **COLOMBO})
    assert response.status_code == 422
    assert "1800" in response.json()["message"]


def test_metadata_lists_panchanga_feature():
    response = client.get("/api/v1/metadata")
    ids = [f["id"] for f in response.json()["features"]]
    assert "panchanga" in ids
    assert "pancha-pakshi" in ids


@pytest.mark.parametrize(
    ("year", "month", "days"),
    [
        (2026, 2, 28),
        (2028, 2, 29),
        (2026, 4, 30),
        (2026, 7, 31),
    ],
)
def test_month_panchanga_returns_calendar_month_length(year, month, days):
    body = _month(COLOMBO, year, month)
    assert body["year"] == year
    assert body["month"] == month
    assert len(body["days"]) == days
    assert body["days"][0]["date"] == f"{year:04d}-{month:02d}-01"


def test_month_panchanga_marks_real_poya_day():
    body = _month(COLOMBO, 2026, 7)
    poya_days = [d for d in body["days"] if d["is_poya_day"]]
    assert [d["date"] for d in poya_days] == ["2026-07-29"]
    assert poya_days[0]["poya"]["month_key"] == "esala"
    assert poya_days[0]["moon_phase"] == "full"


def test_month_panchanga_day_matches_daily_endpoint():
    month_body = _month(COLOMBO, 2026, 7)
    daily_body = _daily(COLOMBO, "2026-07-14")
    day = next(d for d in month_body["days"] if d["date"] == "2026-07-14")
    assert day["weekday"] == daily_body["weekday"]
    assert day["paksha"] == daily_body["paksha"]
    assert day["sinhala_month"] == daily_body["sinhala_month"]
    assert day["is_poya_day"] == daily_body["is_poya_day"]
    assert day["tithi"] == daily_body["tithi"]
    assert day["moonrise"] == daily_body["moonrise"]
    assert day["moonset"] == daily_body["moonset"]


@pytest.mark.parametrize(
    "payload",
    [
        {"year": 2026, "month": 7, "location_name": "X", "latitude": 91.0, "longitude": 0.0, "iana_tz": "UTC"},
        {"year": 2026, "month": 7, "location_name": "X", "latitude": 0.0, "longitude": 181.0, "iana_tz": "UTC"},
        {"year": 2026, "month": 7, "location_name": "X", "latitude": 0.0, "longitude": 0.0, "iana_tz": "Not/AZone"},
        {"year": 2026, "month": 13, **COLOMBO},
    ],
)
def test_month_panchanga_invalid_inputs_rejected(payload):
    response = client.post("/api/v1/panchanga/month", json=payload)
    assert response.status_code == 422


def test_month_panchanga_image_profile_date_range(monkeypatch):
    from app.modules.pancha_pakshi import validation

    monkeypatch.setattr(validation, "_IMAGE_PROFILE", True)
    response = client.post("/api/v1/panchanga/month", json={"year": 1750, "month": 6, **COLOMBO})
    assert response.status_code == 422
    assert "1800" in response.json()["message"]

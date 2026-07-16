"""Disha Shool (travel-direction caution) coverage.

Pure weekday lookup, no birth data — verified against the vendored engine
directly and cross-checked against the standard published weekday table
(Sunday-West, Monday-East, Tuesday-North, Wednesday-North, Thursday-South,
Friday-West, Saturday-East), same pattern as test_tara_bala.py /
test_chandrashtama.py.
"""
from fastapi.testclient import TestClient

from app.main import app
from app.modules.pancha_pakshi import adapter, calculator, repository

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}

# 2026-07-12 is a known Sunday in Colombo local time.
_PUBLISHED_WEEKDAY_DIRECTIONS = {
    "sunday": "west",
    "monday": "east",
    "tuesday": "north",
    "wednesday": "north",
    "thursday": "south",
    "friday": "west",
    "saturday": "east",
}


def _schedule(target_date: str) -> dict:
    response = client.post(
        "/api/v1/pancha-pakshi/schedule",
        json={**COLOMBO, "method": "bird", "bird": "vulture", "target_date": target_date, "target_time": "12:00:00"},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_compute_disha_shool_matches_vendored_engine_directly():
    adapter.ensure_ayanamsa()
    place = adapter.place("Colombo", COLOMBO["latitude"], COLOMBO["longitude"], 5.5)
    jd = adapter.julian_day_number(adapter.date(2026, 7, 12), (12, 0, 0))
    result = calculator.compute_disha_shool(jd, place)
    expected = repository.DISHA_KEYS[adapter.disha_shool_index(jd, place)]
    assert result == expected
    assert result in repository.DISHA_KEYS


def test_disha_shool_matches_published_weekday_table_across_a_full_week():
    for offset, (weekday, expected_direction) in enumerate(_PUBLISHED_WEEKDAY_DIRECTIONS.items()):
        target_date = f"2026-07-{12 + offset:02d}"
        body = _schedule(target_date)
        assert body["weekday"] == weekday, f"{target_date} expected {weekday}, got {body['weekday']}"
        assert body["disha_shool"] == expected_direction, (
            f"{target_date} ({weekday}): expected {expected_direction}, got {body['disha_shool']}"
        )


def test_disha_shool_present_for_all_three_methods():
    birth_body = client.post(
        "/api/v1/pancha-pakshi/schedule",
        json={
            **COLOMBO,
            "method": "birth_datetime",
            "birth_date": "1996-12-07",
            "birth_time": "10:34:00",
            "target_date": "2026-07-12",
            "target_time": "12:00:00",
        },
    ).json()
    nakshatra_body = client.post(
        "/api/v1/pancha-pakshi/schedule",
        json={
            **COLOMBO,
            "method": "nakshatra_paksha",
            "nakshatra_index": 5,
            "paksha": "waxing",
            "target_date": "2026-07-12",
            "target_time": "12:00:00",
        },
    ).json()
    bird_body = _schedule("2026-07-12")

    for body in (birth_body, nakshatra_body, bird_body):
        assert body["disha_shool"] == "west"

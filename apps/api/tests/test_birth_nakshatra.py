from fastapi.testclient import TestClient

from app.main import app
from app.modules.pancha_pakshi import adapter
from app.modules.pancha_pakshi.enums import BirdId

client = TestClient(app)

COLOMBO_BIRTH = {
    "birth_date": "2000-01-01",
    "birth_time": "12:00:00",
    "location_name": "Colombo, Sri Lanka",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def test_birth_nakshatra_resolve_matches_vendored_engine_directly():
    response = client.post("/api/v1/birth-nakshatra/resolve", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()

    adapter.ensure_ayanamsa()
    place = adapter.place("Colombo, Sri Lanka", 6.9271, 79.8612, 6.0)
    jd = adapter.julian_day_number(adapter.date(2000, 1, 1), (12, 0, 0))
    raw_nakshatra = adapter.nakshatra_with_pada(jd, place)
    paksha_1based = adapter.paksha_index_1based(jd, place)
    bird_1based = adapter.birth_bird_1based(int(raw_nakshatra[0]), paksha_1based)

    assert data["nakshatra"]["index"] == int(raw_nakshatra[0])
    assert data["nakshatra"]["pada"] == int(raw_nakshatra[1])
    assert data["paksha"] == ("waxing" if paksha_1based == 1 else "waning")
    assert data["moon_rashi"]["index"] == adapter.natal_moon_rashi_1based(jd, place)
    assert data["birth_bird"] == list(BirdId)[bird_1based - 1].value
    assert data["location"]["utc_offset_minutes"] == 360


def test_birth_nakshatra_rejects_invalid_timezone():
    response = client.post(
        "/api/v1/birth-nakshatra/resolve",
        json={**COLOMBO_BIRTH, "iana_tz": "Not/AZone"},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_input"


def test_birth_nakshatra_has_no_get_route_for_birth_fields():
    response = client.get(
        "/api/v1/birth-nakshatra/resolve?birth_date=2000-01-01&birth_time=12:00:00"
    )
    assert response.status_code == 405

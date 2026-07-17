"""D9 (Navamsa) divisional chart coverage.

No test fixture exists anywhere in the vendored engine for divisional
charts (unlike every other feature this session — ayanamsa validated
against Aluth Avurudu, Poya against 73 gazetted dates, eclipses against
real historical events). Correctness is instead verified two ways: (1) a
golden-value check computing the raw engine output directly and comparing
against the API response (same pattern as every other module this
session), and (2) an independent re-derivation of the classical Navamsa
rule from scratch, swept across all 12 rashi types, confirming
drik.dasavarga_from_long() matches it everywhere except at exact
floating-point navamsa-boundary values (a measure-zero artifact that never
occurs for a real planetary longitude).
"""
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

from jhora.panchanga import drik  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core import rate_limit  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.pancha_pakshi import adapter as pp_adapter  # noqa: E402
from app.modules.panchanga import repository as panchanga_repository  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_rate_limit_buckets():
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


COLOMBO_BIRTH = {
    "birth_date": "2000-01-01",
    "birth_time": "12:00:00",
    "location_name": "Colombo, Sri Lanka",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def _classical_navamsa(longitude: float) -> int:
    """Independent re-derivation of the classical Navamsa rule, NOT derived
    from drik.dasavarga_from_long()'s own code — movable signs (Aries,
    Cancer, Libra, Capricorn) count from themselves; fixed signs (Taurus,
    Leo, Scorpio, Aquarius) count from the 9th sign from themselves; dual
    signs (Gemini, Virgo, Sagittarius, Pisces) count from the 5th. Each
    30-degree rashi holds 9 navamsas of 3 deg 20 min each."""
    longitude = longitude % 360.0
    rashi = int(longitude // 30)
    deg_in_rashi = longitude - rashi * 30
    navamsa_index = int(deg_in_rashi // (10.0 / 3.0))
    if rashi % 3 == 0:
        start = rashi
    elif rashi % 3 == 1:
        start = (rashi + 8) % 12
    else:
        start = (rashi + 4) % 12
    return (start + navamsa_index) % 12


def test_dasavarga_from_long_matches_classical_navamsa_rule():
    configure_ayanamsa(drik)
    mismatches = []
    for rashi in range(12):
        base = rashi * 30
        # Deliberately avoid exact multiples of 3 deg 20 min (10/3) -- those
        # are measure-zero floating-point tie-breaking boundaries where the
        # two independently-written implementations can legitimately land on
        # either side, confirmed via direct reproduction (e.g. exactly 20.0
        # degrees from a rashi start), not a real disagreement.
        for offset in (0.05, 3.4, 6.7, 15.0, 20.05, 29.95):
            longitude = base + offset
            engine_result = drik.dasavarga_from_long(longitude, 9)[0]
            expected = _classical_navamsa(longitude)
            if engine_result != expected:
                mismatches.append((longitude, engine_result, expected))
    assert mismatches == []


def test_navamsa_chart_matches_vendored_engine_directly():
    response = client.post("/api/v1/divisional-charts/navamsa", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()

    configure_ayanamsa(drik)
    place = pp_adapter.place("Colombo, Sri Lanka", 6.9271, 79.8612, 6.0)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2000, 1, 1), (12, 0, 0))

    raw_placements = drik.dhasavarga(jd, place, divisional_chart_factor=9)
    expected_by_key = {
        panchanga_repository.GRAHA_KEYS[planet_id]: constellation for planet_id, (constellation, _) in raw_placements
    }
    assert len(data["placements"]) == 9
    for placement in data["placements"]:
        expected_constellation = expected_by_key[placement["key"]]
        assert placement["rashi_index"] == expected_constellation + 1
        assert placement["rashi_key"] == panchanga_repository.RASHI_KEYS[expected_constellation]

    asc_constellation, asc_coordinates, _, _ = drik.ascendant(jd, place)
    asc_longitude = asc_constellation * 30 + asc_coordinates
    expected_asc_constellation = drik.dasavarga_from_long(asc_longitude, 9)[0]
    assert data["ascendant_rashi_index"] == expected_asc_constellation + 1
    assert data["ascendant_rashi_key"] == panchanga_repository.RASHI_KEYS[expected_asc_constellation]
    assert data["location"]["utc_offset_minutes"] == 360


def test_navamsa_chart_rejects_invalid_timezone():
    response = client.post(
        "/api/v1/divisional-charts/navamsa",
        json={**COLOMBO_BIRTH, "iana_tz": "Not/AZone"},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_input"


def test_navamsa_chart_rejects_invalid_latitude():
    response = client.post(
        "/api/v1/divisional-charts/navamsa",
        json={**COLOMBO_BIRTH, "latitude": 999},
    )
    assert response.status_code == 422


def test_navamsa_chart_has_no_get_route_for_birth_fields():
    response = client.get(
        "/api/v1/divisional-charts/navamsa?birth_date=2000-01-01&birth_time=12:00:00"
    )
    assert response.status_code == 405

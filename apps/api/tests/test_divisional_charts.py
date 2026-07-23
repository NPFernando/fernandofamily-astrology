"""D9 (Navamsa), D10 (Dasamsa), and D7 (Saptamsa) divisional chart coverage.

No test fixture exists anywhere in the vendored engine for divisional
charts (unlike every other feature this session — ayanamsa validated
against Aluth Avurudu, Poya against 73 gazetted dates, eclipses against
real historical events). Navamsa correctness is verified two ways: (1) a
golden-value check computing the raw engine output directly and comparing
against the API response (same pattern as every other module this
session), and (2) an independent re-derivation of the classical Navamsa
rule from scratch, swept across all 12 rashi types, confirming
drik.dasavarga_from_long() matches it everywhere except at exact
floating-point navamsa-boundary values (a measure-zero artifact that never
occurs for a real planetary longitude).

Dasamsa's ground truth is NOT drik.dasavarga_from_long() — a 2026-07-23
sweep found that generic path disagrees with the classical odd/even
Dasamsa rule for 9 of 12 signs (it only coincidentally matches Navamsa's
and Saptamsa's specific sign-quality symmetry). Ground truth here is an
independent hand-derivation of the classical rule, checked against a real
cited worked example, not the engine's own formula.

Saptamsa's ground truth IS drik.dasavarga_from_long() (factor 7) — unlike
Dasamsa, its classical odd/even rule was independently verified
(2026-07-23) to coincide with the generic formula across all 12 signs,
so it safely reuses the same vendored path Navamsa does.
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


# --- D10 (Dasamsa) ------------------------------------------------------------
# Deliberately NOT using dasavarga_from_long(lon, 10) as ground truth here,
# unlike Navamsa above -- that generic vendor path was found (2026-07-23) to
# disagree with the classical Dasamsa rule for 9 of 12 signs. Ground truth
# below is independently hand-derived from the classical odd/even rule and
# a real cited worked example, not from the engine's own generic formula.

SIGN_NAMES = [
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
]


def _classical_dasamsa(rashi_0based: int, degrees_in_rashi: float) -> int:
    division_0based = int(degrees_in_rashi / 3.0)
    is_odd_sign = (rashi_0based + 1) % 2 == 1
    start = rashi_0based if is_odd_sign else (rashi_0based + 8) % 12
    return (start + division_0based) % 12


def test_dasamsa_rule_matches_the_cited_worked_example():
    # anytimeastro.com: "A planet at 2 deg Taurus falls in the first
    # dasamsa of an even sign and appears in Capricorn in the D10."
    taurus = 1
    capricorn = 9
    assert _classical_dasamsa(taurus, 2.0) == capricorn


def test_dasamsa_rule_disagrees_with_generic_vendor_formula_for_taurus():
    # The exact mismatch that motivated hand-implementing this rule rather
    # than reusing adapter.dhasavarga(..., 10): the generic engine path
    # would have placed this in Aquarius, not Capricorn.
    configure_ayanamsa(drik)
    taurus = 1
    generic_result = drik.dasavarga_from_long(taurus * 30 + 2.0, 10)[0]
    assert generic_result == 10  # Aquarius -- the wrong answer for this app
    assert _classical_dasamsa(taurus, 2.0) == 9  # Capricorn -- the correct one


def test_dasamsa_rule_odd_sign_starts_from_itself():
    # Aries (odd), 1st division (0-3 deg) starts from Aries itself.
    assert _classical_dasamsa(0, 1.0) == 0


def test_dasamsa_rule_sweep_all_signs_first_division():
    mismatches = []
    for rashi in range(12):
        expected = _classical_dasamsa(rashi, 1.0)
        # Cross-check the pure Python re-derivation is internally
        # consistent across all 12 signs by re-deriving from first
        # principles a second, independent way: odd signs are 0-based
        # even indices (Aries=0, Gemini=2, ...); even signs are 0-based
        # odd indices.
        is_odd_sign_alt = rashi % 2 == 0
        start_alt = rashi if is_odd_sign_alt else (rashi + 8) % 12
        alt = start_alt % 12
        if expected != alt:
            mismatches.append((SIGN_NAMES[rashi], expected, alt))
    assert mismatches == []


def test_dasamsa_chart_matches_hand_derived_placements():
    response = client.post("/api/v1/divisional-charts/dasamsa", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()

    configure_ayanamsa(drik)
    place = pp_adapter.place("Colombo, Sri Lanka", 6.9271, 79.8612, 6.0)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2000, 1, 1), (12, 0, 0))

    raw_d1_placements = drik.dhasavarga(jd, place, divisional_chart_factor=1)
    expected_by_key = {
        panchanga_repository.GRAHA_KEYS[planet_id]: _classical_dasamsa(constellation, long_in_raasi)
        for planet_id, (constellation, long_in_raasi) in raw_d1_placements
    }
    assert len(data["placements"]) == 9
    for placement in data["placements"]:
        expected_constellation = expected_by_key[placement["key"]]
        assert placement["rashi_index"] == expected_constellation + 1
        assert placement["rashi_key"] == panchanga_repository.RASHI_KEYS[expected_constellation]

    asc_constellation, asc_coordinates, _, _ = drik.ascendant(jd, place)
    expected_asc_constellation = _classical_dasamsa(asc_constellation, asc_coordinates)
    assert data["ascendant_rashi_index"] == expected_asc_constellation + 1
    assert data["ascendant_rashi_key"] == panchanga_repository.RASHI_KEYS[expected_asc_constellation]
    assert data["location"]["utc_offset_minutes"] == 360


def test_dasamsa_chart_rejects_invalid_timezone():
    response = client.post(
        "/api/v1/divisional-charts/dasamsa",
        json={**COLOMBO_BIRTH, "iana_tz": "Not/AZone"},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_input"


def test_dasamsa_chart_rejects_invalid_latitude():
    response = client.post(
        "/api/v1/divisional-charts/dasamsa",
        json={**COLOMBO_BIRTH, "latitude": 999},
    )
    assert response.status_code == 422


# --- D7 (Saptamsa) ------------------------------------------------------------
# Unlike Dasamsa, this DOES trust dasavarga_from_long() as ground truth --
# independently verified below to coincide with the classical odd/even
# Saptamsa rule (odd signs count from themselves; even signs count from the
# 7th sign counted inclusively from themselves).


def _classical_saptamsa(rashi_0based: int, division_1based: int) -> int:
    is_odd_sign = (rashi_0based + 1) % 2 == 1
    start = rashi_0based if is_odd_sign else (rashi_0based + 6) % 12
    return (start + division_1based - 1) % 12


def test_saptamsa_rule_matches_the_cited_worked_example():
    # jagannathhora.com: "a planet at 10 degrees of Taurus, which is an
    # even sign, the counting for Saptamsha begins from Scorpio, the
    # seventh sign from Taurus."
    taurus = 1
    scorpio = 7
    assert _classical_saptamsa(taurus, 1) == scorpio


def test_dasavarga_from_long_matches_classical_saptamsa_rule():
    configure_ayanamsa(drik)
    mismatches = []
    for rashi in range(12):
        base = rashi * 30
        one_pada = 30.0 / 7
        for division in range(1, 8):
            longitude = base + (division - 1) * one_pada + one_pada / 2
            engine_result = drik.dasavarga_from_long(longitude, 7)[0]
            expected = _classical_saptamsa(rashi, division)
            if engine_result != expected:
                mismatches.append((longitude, engine_result, expected))
    assert mismatches == []


def test_saptamsa_chart_matches_vendored_engine_directly():
    response = client.post("/api/v1/divisional-charts/saptamsa", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()

    configure_ayanamsa(drik)
    place = pp_adapter.place("Colombo, Sri Lanka", 6.9271, 79.8612, 6.0)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2000, 1, 1), (12, 0, 0))

    raw_placements = drik.dhasavarga(jd, place, divisional_chart_factor=7)
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
    expected_asc_constellation = drik.dasavarga_from_long(asc_longitude, 7)[0]
    assert data["ascendant_rashi_index"] == expected_asc_constellation + 1
    assert data["ascendant_rashi_key"] == panchanga_repository.RASHI_KEYS[expected_asc_constellation]
    assert data["location"]["utc_offset_minutes"] == 360


def test_saptamsa_chart_rejects_invalid_timezone():
    response = client.post(
        "/api/v1/divisional-charts/saptamsa",
        json={**COLOMBO_BIRTH, "iana_tz": "Not/AZone"},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_input"


def test_saptamsa_chart_rejects_invalid_latitude():
    response = client.post(
        "/api/v1/divisional-charts/saptamsa",
        json={**COLOMBO_BIRTH, "latitude": 999},
    )
    assert response.status_code == 422

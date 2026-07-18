"""D1 (Rasi) birth chart coverage.

Unlike Navamsa (which has real fractional-degree boundary math worth an
independent from-scratch re-derivation), D1 whole-sign placement is direct
arithmetic on two already-used engine calls (dhasavarga at factor 1,
ascendant), so one verification layer is enough: (1) a golden-value check
computing the raw engine output directly and comparing against the API
response, (2) a cross-module sanity check confirming D1 truly is
"divisional factor 1" by comparing against divisional_charts' own
dhasavarga call, and (3) a check that skipping the dasavarga_from_long
re-projection for the Ascendant is provably equivalent to running it at
factor 1, substantiating adapter.py's docstring claim directly.

Degree-level comparisons use a loose (0.01 degree / ~36 arcsec) tolerance,
not exact equality: going through an actual API request (vs. a same-thread
direct call) reproducibly shifts the last few significant digits of a
sidereal longitude by a few arcseconds, varying per planet (observed
~0.18-4 arcsec across different grahas) -- confirmed via a direct
ThreadPoolExecutor reproduction to be a same-process, cross-thread swisseph
floating-point effect, in the same family core_vendor_path.configure_
ayanamsa's docstring already documents for the (much larger, ~0.9 degree)
ayanamsa-family leak. This is two-plus orders of magnitude below what this
UI ever displays (arcminute precision) and far below what would mask a real
bug (a wrong rashi/planet mismatch, or an ayanamsa-family error, would both
be off by whole degrees), so it's tolerated here rather than chased down --
root-causing swisseph's exact thread behavior is a separate, deeper
investigation than this module's degree-display feature warrants.
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


def test_birth_chart_matches_vendored_engine_directly():
    response = client.post("/api/v1/birth-chart/rasi", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()

    configure_ayanamsa(drik)
    place = pp_adapter.place("Colombo, Sri Lanka", 6.9271, 79.8612, 6.0)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2000, 1, 1), (12, 0, 0))

    raw_placements = drik.dhasavarga(jd, place, divisional_chart_factor=1)
    expected_by_key = {
        panchanga_repository.GRAHA_KEYS[planet_id]: (constellation, long_in_raasi)
        for planet_id, (constellation, long_in_raasi) in raw_placements
    }
    assert len(data["placements"]) == 9
    for placement in data["placements"]:
        expected_constellation, expected_degrees = expected_by_key[placement["key"]]
        assert placement["rashi_index"] == expected_constellation + 1
        assert placement["rashi_key"] == panchanga_repository.RASHI_KEYS[expected_constellation]
        assert placement["degrees"] == pytest.approx(expected_degrees, abs=0.01)

    asc_constellation, asc_coordinates, _, _ = drik.ascendant(jd, place)
    assert data["ascendant_rashi_index"] == asc_constellation + 1
    assert data["ascendant_rashi_key"] == panchanga_repository.RASHI_KEYS[asc_constellation]
    assert data["ascendant_degrees"] == pytest.approx(asc_coordinates, abs=0.01)
    assert data["location"]["utc_offset_minutes"] == 360


def test_dhasavarga_factor_1_matches_divisional_charts_own_call():
    """D1 truly is "divisional_chart_factor=1", not a birth_chart-specific
    reimplementation — confirmed by comparing against divisional_charts'
    own dhasavarga call at the same factor, tying the two modules together
    as an assertion rather than a code dependency."""
    configure_ayanamsa(drik)
    place = pp_adapter.place("Colombo, Sri Lanka", 6.9271, 79.8612, 6.0)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2000, 1, 1), (12, 0, 0))

    from app.modules.birth_chart import adapter as birth_chart_adapter
    from app.modules.divisional_charts import adapter as divisional_charts_adapter

    assert birth_chart_adapter.graha_positions(jd, place) == divisional_charts_adapter.dhasavarga(jd, place, 1)


def test_ascendant_rashi_matches_dasavarga_from_long_at_factor_1():
    """Substantiates adapter.py's docstring claim that skipping the
    dasavarga_from_long re-projection for D1's Ascendant is provably
    equivalent to running it at factor 1, not just asserted."""
    configure_ayanamsa(drik)
    place = pp_adapter.place("Colombo, Sri Lanka", 6.9271, 79.8612, 6.0)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2000, 1, 1), (12, 0, 0))

    constellation, coordinates, _, _ = drik.ascendant(jd, place)
    asc_longitude = constellation * 30 + coordinates
    projected_constellation, _long_in_raasi = drik.dasavarga_from_long(asc_longitude, 1)
    assert projected_constellation == constellation


def test_birth_chart_rejects_invalid_timezone():
    response = client.post(
        "/api/v1/birth-chart/rasi",
        json={**COLOMBO_BIRTH, "iana_tz": "Not/AZone"},
    )
    assert response.status_code == 422
    assert response.json()["error"] == "invalid_input"


def test_birth_chart_rejects_invalid_latitude():
    response = client.post(
        "/api/v1/birth-chart/rasi",
        json={**COLOMBO_BIRTH, "latitude": 999},
    )
    assert response.status_code == 422


def test_birth_chart_has_no_get_route_for_birth_fields():
    response = client.get("/api/v1/birth-chart/rasi?birth_date=2000-01-01&birth_time=12:00:00")
    assert response.status_code == 405

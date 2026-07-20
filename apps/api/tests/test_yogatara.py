"""Yogatara (junction star) coverage for the birth chart's fixed-star layer.

Two verification layers, matching the module's design (see
app/modules/birth_chart/yogatara.py for the pinned source):

1. Catalog identity: each sefstars.txt search key must resolve to the star
   the CRC 1955 Table 5 identifies. Ecliptic latitude is the discriminator —
   it is nearly epoch-independent (longitude precesses ~50 arcsec/year;
   latitude drifts arcseconds/century), and CRC prints it per star, so the
   1956 values work as identity goldens today. This is what caught the
   Vishakha trap during research: sefstars.txt's own "Vishakha" alias points
   to iota-1 Librae (latitude -1.85 deg), but CRC's alpha Librae entry
   (+0 deg 20 min) matches alpha-2 (+0.333 deg) — so the mapping pins
   ",al-2Lib" and this test would fail loudly if anyone "simplified" it back
   to the catalog alias.

2. API-vs-direct-engine goldens plus structural invariants, in the style of
   test_birth_chart.py (same COLOMBO_BIRTH fixture, same 0.01-degree
   cross-thread tolerance rationale — see that module's docstring).
"""
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

import swisseph as swe  # noqa: E402
from jhora.panchanga import drik  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core import rate_limit  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.birth_chart.yogatara import CRC_LATITUDES, YOGATARA_STARS  # noqa: E402
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

NAKSHATRA_SPAN = 360.0 / 27.0


def _direct_star_longitudes() -> dict[str, float]:
    """The same computation the adapter does, same-thread: sidereal
    longitudes of all 27 yogataras at the COLOMBO_BIRTH instant."""
    configure_ayanamsa(drik)
    jd = pp_adapter.julian_day_number(pp_adapter.date(2000, 1, 1), (12, 0, 0))
    jd_utc = jd - 5.5 / 24.0  # Asia/Colombo on 2000-01-01 is UTC+5:30
    flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL
    return {
        nakshatra_key: swe.fixstar_ut(search_key, jd_utc, flags)[0][0]
        for nakshatra_key, search_key, _label in YOGATARA_STARS
    }


def test_catalog_identity_matches_crc_latitudes():
    """Every search key resolves, and to the star CRC Table 5 names —
    discriminated by ecliptic latitude (see module docstring)."""
    configure_ayanamsa(drik)
    flags = swe.FLG_SWIEPH | swe.FLG_SIDEREAL
    jd_utc = 2451545.0  # J2000; any epoch works for latitude
    assert len(YOGATARA_STARS) == 27
    for nakshatra_key, search_key, _label in YOGATARA_STARS:
        (xx, _resolved, _retflag) = swe.fixstar_ut(search_key, jd_utc, flags)
        latitude = xx[1]
        assert latitude == pytest.approx(CRC_LATITUDES[nakshatra_key], abs=0.1), (
            f"{nakshatra_key} ({search_key}): latitude {latitude:.3f} does not "
            f"match CRC Table 5's {CRC_LATITUDES[nakshatra_key]}"
        )


def test_chitra_anchors_the_ayanamsa():
    """Under this app's pinned Lahiri ayanamsa, Spica (Chitra) must sit at
    the 180-degree point — the very definition the 1955 committee anchored
    the zodiac to. A failure here means the ayanamsa configuration broke."""
    longitudes = _direct_star_longitudes()
    assert longitudes["chitra"] == pytest.approx(180.0, abs=0.15)


def test_yogataras_match_direct_engine():
    response = client.post("/api/v1/birth-chart/rasi", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()

    expected = _direct_star_longitudes()
    assert len(data["yogataras"]) == 27
    for entry in data["yogataras"]:
        expected_lon = expected[entry["nakshatra_key"]]
        api_lon = (entry["rashi_index"] - 1) * 30.0 + entry["degrees"]
        assert api_lon == pytest.approx(expected_lon, abs=0.01), entry["nakshatra_key"]
        assert entry["rashi_key"] == panchanga_repository.RASHI_KEYS[entry["rashi_index"] - 1]


def test_structural_invariants():
    response = client.post("/api/v1/birth-chart/rasi", json=COLOMBO_BIRTH)
    assert response.status_code == 200, response.text
    data = response.json()

    # 27 yogataras in NAKSHATRA_KEYS order, degrees within a rashi's span.
    assert [y["nakshatra_key"] for y in data["yogataras"]] == panchanga_repository.NAKSHATRA_KEYS
    for entry in data["yogataras"]:
        assert 1 <= entry["rashi_index"] <= 12
        assert 0.0 <= entry["degrees"] < 30.0

    # 9 graha rows in GRAHA_KEYS order; nakshatra re-derivable from the
    # placement's own longitude; separation within the half-circle.
    assert [g["key"] for g in data["graha_yogataras"]] == panchanga_repository.GRAHA_KEYS
    placements_by_key = {p["key"]: p for p in data["placements"]}
    for row in data["graha_yogataras"]:
        placement = placements_by_key[row["key"]]
        graha_lon = (placement["rashi_index"] - 1) * 30.0 + placement["degrees"]
        expected_nakshatra = panchanga_repository.NAKSHATRA_KEYS[int(graha_lon // NAKSHATRA_SPAN)]
        assert row["nakshatra_key"] == expected_nakshatra
        assert 0.0 <= row["separation_degrees"] <= 180.0


def test_moon_nakshatra_matches_birth_nakshatra_module():
    """Cross-module identity: the Moon's nakshatra in graha_yogataras must
    equal what the birth-nakshatra module resolves for the same birth —
    both derive it from the same Moon longitude by equal 13deg20' division."""
    chart = client.post("/api/v1/birth-chart/rasi", json=COLOMBO_BIRTH)
    assert chart.status_code == 200, chart.text
    moon_row = next(g for g in chart.json()["graha_yogataras"] if g["key"] == "moon")

    nakshatra = client.post(
        "/api/v1/birth-nakshatra/resolve",
        json={
            "birth_date": COLOMBO_BIRTH["birth_date"],
            "birth_time": COLOMBO_BIRTH["birth_time"],
            "location_name": COLOMBO_BIRTH["location_name"],
            "latitude": COLOMBO_BIRTH["latitude"],
            "longitude": COLOMBO_BIRTH["longitude"],
            "iana_tz": COLOMBO_BIRTH["iana_tz"],
        },
    )
    assert nakshatra.status_code == 200, nakshatra.text
    assert moon_row["nakshatra_key"] == nakshatra.json()["nakshatra"]["key"]

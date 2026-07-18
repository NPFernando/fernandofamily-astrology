"""Porondam (Sri Lankan wedding horoscope matching) coverage.

Ships 7 of the traditional 10-12 core Porondama (Nakshatra/Tara, Gana,
Yoni, Rashi, Rashyadpathi, Vashya, Vedha). Each sub-Porondama is tested
against its own classical table, independently cross-checked by hand
against the standard, widely-published Ashtakoot / Tamil Thirumana
Porutham nakshatra/rashi assignments (not just internal self-consistency)
— same bar as every other feature this session (ayanamsa, Poya, eclipses,
Navamsa). Vedha's table was cross-checked against two independent sources
that agree on 26 of 27 nakshatras; the one disputed nakshatra (Chitra) is
deliberately resolved as "no vedha partner" (see repository.py). Rajju was
researched too but found to have real, substantive disagreement across
independent sources (not a single formatting quirk) — deferred, not built
from conflicting recall. Nakshatra/rashi indices below use panchanga.
repository's 1-based convention: nakshatra 1=Ashwini .. 27=Revati, rashi
1=Mesha .. 12=Meena.
"""
import pytest
from fastapi.testclient import TestClient

from app.core import rate_limit
from app.main import app
from app.modules.porondam.calculator import (
    compute_gana_porondam,
    compute_nakshatra_porondam,
    compute_porondam,
    compute_rashi_porondam,
    compute_rashyadpathi_porondam,
    compute_vashya_porondam,
    compute_vedha_porondam,
    compute_yoni_porondam,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_rate_limit_buckets():
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


COLOMBO = {
    "location_name": "Colombo, Sri Lanka",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}
KANDY = {
    "location_name": "Kandy, Sri Lanka",
    "latitude": 7.2906,
    "longitude": 80.6337,
    "iana_tz": "Asia/Colombo",
}
GALLE = {
    "location_name": "Galle, Sri Lanka",
    "latitude": 6.0535,
    "longitude": 80.2210,
    "iana_tz": "Asia/Colombo",
}


# --- Nakshatra (Tara) Porondam ----------------------------------------------
# Same mod-9 counting already vendored/used for this session's own Tara Bala
# feature (vendor/jhora/utils.py:905 count_stars, drik.py:3524
# good_tharaabalam = [0,2,4,6,8]), applied bidirectionally.


def test_nakshatra_porondam_same_star_fails_janma_tara():
    # count_stars(1,1) = 1 -> category 1 % 9 = 1 (Janma tara), NOT in the
    # classical "good" set {0,2,4,6,8} -- the same star for both partners is
    # not treated as automatically favorable under this system.
    assert compute_nakshatra_porondam(1, 1).passed is False


def test_nakshatra_porondam_passes_when_both_directions_are_good():
    # Ashwini(1) -> Bharani(2): count_stars = 2, category 2 % 9 = 2 (good).
    # Bharani(2) -> Ashwini(1): count_stars = 27, category 27 % 9 = 0 (good).
    assert compute_nakshatra_porondam(1, 2).passed is True


def test_nakshatra_porondam_fails_when_only_one_direction_is_good():
    # Ashwini(1) -> Rohini(4): count_stars = 4, category 4 % 9 = 4 (good).
    # Rohini(4) -> Ashwini(1): count_stars = 25, category 25 % 9 = 7 (NOT
    # good) -- the bidirectional check requires both directions to pass.
    assert compute_nakshatra_porondam(1, 4).passed is False


# --- Gana Porondam -----------------------------------------------------------
# Standard classical Deva/Manushya/Rakshasa assignment (widely published,
# e.g. Ashwini=Deva, Bharani=Manushya, Krittika=Rakshasa, Ashlesha=Rakshasa).


def test_gana_porondam_same_group_passes():
    # Ashwini(1, Deva) & Mrigashirsha(5, Deva).
    assert compute_gana_porondam(1, 5).passed is True


def test_gana_porondam_deva_manushya_passes():
    # Ashwini(1, Deva) & Bharani(2, Manushya) -- the one cross-group
    # combination the classical simplified rule still allows.
    assert compute_gana_porondam(1, 2).passed is True


def test_gana_porondam_deva_rakshasa_fails():
    # Ashwini(1, Deva) & Krittika(3, Rakshasa).
    assert compute_gana_porondam(1, 3).passed is False


def test_gana_porondam_manushya_rakshasa_fails():
    # Bharani(2, Manushya) & Krittika(3, Rakshasa).
    assert compute_gana_porondam(2, 3).passed is False


def test_gana_porondam_rakshasa_rakshasa_passes():
    # Krittika(3, Rakshasa) & Ashlesha(9, Rakshasa) -- same group.
    assert compute_gana_porondam(3, 9).passed is True


# --- Yoni Porondam -----------------------------------------------------------
# Standard classical 27-nakshatra -> 14-animal assignment and the 7 natural
# enemy pairs (widely published Ashtakoot Yoni table).


def test_yoni_porondam_non_enemy_passes():
    # Ashwini(1, horse) & Krittika(3, sheep) -- not an enemy pair.
    assert compute_yoni_porondam(1, 3).passed is True


def test_yoni_porondam_horse_buffalo_enemy_fails():
    # Ashwini(1, horse) & Hasta(13, buffalo) -- classical enemy pair.
    assert compute_yoni_porondam(1, 13).passed is False


def test_yoni_porondam_elephant_lion_enemy_fails():
    # Bharani(2, elephant) & Dhanishtha(23, lion) -- classical enemy pair.
    assert compute_yoni_porondam(2, 23).passed is False


def test_yoni_porondam_serpent_mongoose_enemy_fails():
    # Rohini(4, serpent) & Uttara Ashadha(21, mongoose) -- mongoose is the
    # single nakshatra (of 27) assigned its own yoni type, and its one
    # classical enmity is with serpent.
    assert compute_yoni_porondam(4, 21).passed is False


def test_yoni_porondam_rat_cat_enemy_fails():
    # Magha(10, rat) & Punarvasu(7, cat) -- classical enemy pair.
    assert compute_yoni_porondam(10, 7).passed is False


# --- Rashi (Bhakoot) Porondam ------------------------------------------------
# Pure rashi-distance arithmetic -- classical dosha distances are the
# 2nd/12th, 5th/9th and 6th/8th relationships; the 7th (opposition) is
# explicitly NOT a dosha distance under this rule.


def test_rashi_porondam_same_rashi_passes():
    assert compute_rashi_porondam(1, 1).passed is True


def test_rashi_porondam_second_from_each_other_fails():
    # Mesha(1) & Vrishabha(2): distance 2 -- a 2nd/12th dosha relationship.
    assert compute_rashi_porondam(1, 2).passed is False


def test_rashi_porondam_fifth_from_each_other_fails():
    # Mesha(1) & Simha(5): distance 5 -- a 5th/9th dosha relationship.
    assert compute_rashi_porondam(1, 5).passed is False


def test_rashi_porondam_seventh_opposition_is_not_a_dosha():
    # Mesha(1) & Tula(7): distance 7 -- opposition is a normal spousal
    # relationship in this system, not one of the dosha distances.
    assert compute_rashi_porondam(1, 7).passed is True


# --- Rashyadpathi Porondam ----------------------------------------------------
# Classical Naisargika Maitri (natural planetary friendship/enmity) table,
# applied to each rashi's ruling planet.


def test_rashyadpathi_porondam_same_lord_passes():
    # Mesha(mars) & Vrischika(mars) -- both ruled by Mars.
    assert compute_rashyadpathi_porondam(1, 8).passed is True


def test_rashyadpathi_porondam_friendly_lords_passes():
    # Mesha(mars) & Simha(sun) -- Mars and Sun are classical friends.
    assert compute_rashyadpathi_porondam(1, 5).passed is True


def test_rashyadpathi_porondam_enemy_lords_fails():
    # Mithuna(mercury) & Karka(moon) -- Mercury's classical enemy is Moon.
    assert compute_rashyadpathi_porondam(3, 4).passed is False


def test_rashyadpathi_porondam_venus_sun_enemy_fails():
    # Vrishabha(venus) & Simha(sun) -- Venus's classical enemies include Sun.
    assert compute_rashyadpathi_porondam(2, 5).passed is False


# --- Vashya Porondam ----------------------------------------------------------
# 12 rashis -> 5 temperament groups (simplified to whole-rashi assignment,
# not sub-dividing Dhanu/Makara at their classical half-sign boundary).


def test_vashya_porondam_same_group_passes():
    # Mesha(1, chatushpada) & Vrishabha(2, chatushpada).
    assert compute_vashya_porondam(1, 2).passed is True


def test_vashya_porondam_different_group_fails():
    # Mesha(1, chatushpada) & Mithuna(3, manava).
    assert compute_vashya_porondam(1, 3).passed is False


def test_vashya_porondam_jalachara_group_passes():
    # Karka(4, jalachara) & Meena(12, jalachara).
    assert compute_vashya_porondam(4, 12).passed is True


# --- Vedha Porondam -----------------------------------------------------------
# 13 classical obstruction pairs, cross-checked identical across two
# independent sources for 12 of them plus Mrigashirsha<->Dhanishtha; Chitra
# is the one documented edge case, resolved here as having no vedha partner.


def test_vedha_porondam_non_pair_passes():
    # Ashwini(1) & Bharani(2) -- not a vedha pair.
    assert compute_vedha_porondam(1, 2).passed is True


def test_vedha_porondam_ashwini_jyeshtha_pair_fails():
    # Ashwini(1) <-> Jyeshtha(18) -- classical vedha pair.
    assert compute_vedha_porondam(1, 18).passed is False


def test_vedha_porondam_hasta_shatabhisha_pair_fails():
    # Hasta(13) <-> Shatabhisha(24) -- classical vedha pair.
    assert compute_vedha_porondam(13, 24).passed is False


def test_vedha_porondam_mrigashirsha_dhanishtha_pair_fails():
    # Mrigashirsha(5) <-> Dhanishtha(23) -- agreed by both sources checked,
    # unlike Chitra's disputed treatment.
    assert compute_vedha_porondam(5, 23).passed is False


def test_vedha_porondam_chitra_has_no_partner():
    # Chitra(14) -- deliberately resolved as having no vedha partner (the
    # documented edge case); passes against every other nakshatra.
    assert compute_vedha_porondam(14, 5).passed is True
    assert compute_vedha_porondam(14, 23).passed is True
    assert compute_vedha_porondam(14, 1).passed is True


# --- compute_porondam composition -------------------------------------------


def test_compute_porondam_reports_all_seven_checked():
    result = compute_porondam(nakshatra_a=5, rashi_a=3, nakshatra_b=13, rashi_b=6)
    assert result.checked_count == 7
    assert len(result.matches) == 7
    assert result.passed_count == 7
    assert all(match.passed for match in result.matches)


# --- API level ---------------------------------------------------------------


def _party(birth_date: str, birth_time: str, location: dict) -> dict:
    return {"birth_date": birth_date, "birth_time": birth_time, **location}


def test_porondam_match_endpoint_all_seven_pass():
    # Golden fixture: bride 1995-03-10 06:30 Colombo -> nakshatra 5
    # (mrigashirsha, rashi 3 mithuna); groom 1992-11-20 18:15 Kandy ->
    # nakshatra 13 (hasta, rashi 6 kanya). Verified directly against
    # calculator.compute_porondam with the same inputs before being pinned
    # here as a fixture. (5,13) is not a vedha pair, so all 7 still pass.
    res = client.post(
        "/api/v1/porondam/match",
        json={
            "bride": _party("1995-03-10", "06:30:00", COLOMBO),
            "groom": _party("1992-11-20", "18:15:00", KANDY),
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["bride"]["nakshatra_key"] == "mrigashirsha"
    assert data["bride"]["rashi_key"] == "mithuna"
    assert data["groom"]["nakshatra_key"] == "hasta"
    assert data["groom"]["rashi_key"] == "kanya"
    assert data["result"]["checked_count"] == 7
    assert data["result"]["passed_count"] == 7
    assert all(match["passed"] for match in data["result"]["matches"])
    assert {match["key"] for match in data["result"]["matches"]} == {
        "nakshatra", "gana", "yoni", "rashi", "rashyadpathi", "vashya", "vedha",
    }


def test_porondam_match_endpoint_mixed_result():
    # Golden fixture: bride 1998-06-05 04:00 Colombo -> nakshatra 13
    # (hasta, rashi 6 kanya); groom 1994-01-15 21:45 Galle -> nakshatra 24
    # (shatabhisha, rashi 11 kumbha). Verified directly against
    # calculator.compute_porondam with the same inputs before being pinned
    # here: 2 of 7 pass (rashyadpathi, vashya); nakshatra/gana/yoni/rashi/
    # vedha fail -- Hasta(13)/Shatabhisha(24) is exactly the classical vedha
    # pair. Also exercises the historical 1996-2006 Sri Lanka UTC+6 DST
    # offset already covered by test_timezones_and_edge_cases.py.
    res = client.post(
        "/api/v1/porondam/match",
        json={
            "bride": _party("1998-06-05", "04:00:00", COLOMBO),
            "groom": _party("1994-01-15", "21:45:00", GALLE),
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["bride"]["nakshatra_key"] == "hasta"
    assert data["bride"]["rashi_key"] == "kanya"
    assert data["groom"]["nakshatra_key"] == "shatabhisha"
    assert data["groom"]["rashi_key"] == "kumbha"
    assert data["result"]["checked_count"] == 7
    assert data["result"]["passed_count"] == 2
    by_key = {match["key"]: match["passed"] for match in data["result"]["matches"]}
    assert by_key == {
        "nakshatra": False,
        "gana": False,
        "yoni": False,
        "rashi": False,
        "rashyadpathi": True,
        "vashya": True,
        "vedha": False,
    }


def test_porondam_match_endpoint_invalid_location_rejected():
    res = client.post(
        "/api/v1/porondam/match",
        json={
            "bride": _party("1995-03-10", "06:30:00", {**COLOMBO, "latitude": 999}),
            "groom": _party("1992-11-20", "18:15:00", KANDY),
        },
    )
    assert res.status_code == 422


def test_platform_metadata_does_not_list_porondam_yet():
    # Porondam is not registered in feature-registry/metadata this round --
    # it's reached only via its own route, not surfaced as a public feature
    # tile until the frontend build-out (a later step in this same plan).
    res = client.get("/api/v1/metadata")
    assert res.status_code == 200
    ids = {item["id"] for item in res.json()["features"]}
    assert "porondam" not in ids

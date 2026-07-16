"""Tara Bala (daily star-strength overlay) coverage.

Golden-value check against the vendored engine directly (same pattern as
test_panchanga.py's test_golden_indices_match_vendored_engine), plus a
check that only the methods with a known birth nakshatra (A: birth
date/time, B: known nakshatra+paksha) populate tara_bala — Method C (direct
bird selection) has no birth nakshatra to classify and must stay null.
"""
from fastapi.testclient import TestClient

from app.main import app
from app.modules.pancha_pakshi import adapter, calculator, repository
from app.modules.pancha_pakshi.enums import EffectId

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def _schedule(body: dict) -> dict:
    response = client.post("/api/v1/pancha-pakshi/schedule", json={**COLOMBO, **body})
    assert response.status_code == 200, response.text
    return response.json()


def test_compute_tara_bala_matches_vendored_engine_directly():
    adapter.ensure_ayanamsa()
    place = adapter.place("Colombo", COLOMBO["latitude"], COLOMBO["longitude"], 5.5)
    jd = adapter.julian_day_number(adapter.date(2026, 7, 16), (12, 0, 0))
    raw_groups = adapter.tara_bala_groups(jd, place)
    assert len(raw_groups) == 9
    assert sorted(star for group in raw_groups for star in group) == list(range(1, 28))

    for nakshatra_1based in range(1, 28):
        result = calculator.compute_tara_bala(nakshatra_1based, jd, place)
        expected_index = next(i for i, group in enumerate(raw_groups) if nakshatra_1based in group)
        assert result.key == repository.TARA_KEYS[expected_index]
        assert result.effect == repository.TARA_EFFECT_ORDER[expected_index]


def test_tara_bala_keys_and_effects_are_9_and_aligned():
    assert len(repository.TARA_KEYS) == 9
    assert len(repository.TARA_EFFECT_ORDER) == 9
    assert all(isinstance(effect, EffectId) for effect in repository.TARA_EFFECT_ORDER)


def test_method_birth_datetime_populates_tara_bala():
    body = _schedule(
        {
            "method": "birth_datetime",
            "birth_date": "1996-12-07",
            "birth_time": "10:34:00",
            "target_date": "2026-07-16",
            "target_time": "12:00:00",
        }
    )
    assert body["tara_bala"] is not None
    assert body["tara_bala"]["key"] in repository.TARA_KEYS
    assert body["tara_bala"]["effect"] in [e.value for e in EffectId]


def test_method_nakshatra_paksha_populates_tara_bala():
    body = _schedule(
        {
            "method": "nakshatra_paksha",
            "nakshatra_index": 5,
            "paksha": "waxing",
            "target_date": "2026-07-16",
            "target_time": "12:00:00",
        }
    )
    assert body["tara_bala"] is not None
    place = adapter.place("Colombo", COLOMBO["latitude"], COLOMBO["longitude"], 5.5)
    jd = adapter.julian_day_number(adapter.date(2026, 7, 16), (12, 0, 0))
    expected = calculator.compute_tara_bala(5, jd, place)
    assert body["tara_bala"]["key"] == expected.key
    assert body["tara_bala"]["effect"] == expected.effect.value


def test_method_direct_bird_leaves_tara_bala_null():
    body = _schedule(
        {
            "method": "bird",
            "bird": "vulture",
            "target_date": "2026-07-16",
            "target_time": "12:00:00",
        }
    )
    assert body["tara_bala"] is None

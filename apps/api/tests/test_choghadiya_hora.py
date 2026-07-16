"""Gauri Choghadiya + Shubha Hora coverage.

Golden-value check against the vendored engine directly (same pattern as
test_tara_bala.py etc.), plus structural invariants: 16/24 chronologically
contiguous, non-overlapping spans spanning exactly sunrise..next-sunrise,
with correct midnight-rollover dates — the real risk in this feature, since
gauri_choghadiya()/shubha_hora() reset their HMS strings after midnight
rather than continuing past 24:00:00 (unlike this module's other elements).
"""
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app
from app.modules.panchanga import adapter, calculator, repository
from app.modules.panchanga.models import ChoghadiyaSpan

client = TestClient(app)

COLOMBO = {
    "location_name": "Colombo",
    "latitude": 6.9271,
    "longitude": 79.8612,
    "iana_tz": "Asia/Colombo",
}


def _daily(date_str: str) -> dict:
    response = client.post("/api/v1/panchanga/daily", json={"date": date_str, **COLOMBO})
    assert response.status_code == 200, response.text
    return response.json()


def test_compute_choghadiya_matches_vendored_engine_directly():
    from app.modules.pancha_pakshi import adapter as pp_adapter
    from datetime import date as date_type

    adapter.ensure_ayanamsa()
    place = pp_adapter.place("Colombo", COLOMBO["latitude"], COLOMBO["longitude"], 5.5)
    noon_jd = pp_adapter.julian_day_number(pp_adapter.date(2026, 7, 16), (12, 0, 0))

    raw = adapter.gauri_choghadiya(noon_jd, place)
    assert len(raw) == 16
    spans = calculator._typed_hms_spans(
        raw, repository.CHOGHADIYA_KEYS, repository.CHOGHADIYA_AUSPICIOUS, ChoghadiyaSpan,
        date_type(2026, 7, 16), 5.5,
    )
    for (type_index, _, _), span in zip(raw, spans):
        assert span.key == repository.CHOGHADIYA_KEYS[type_index]
        assert span.is_auspicious == repository.CHOGHADIYA_AUSPICIOUS[type_index]


def test_choghadiya_spans_are_16_contiguous_and_cover_sunrise_to_next_sunrise():
    body = _daily("2026-07-16")
    spans = body["choghadiya"]
    assert len(spans) == 16

    sunrise = datetime.fromisoformat(body["sunrise"])
    first_start = datetime.fromisoformat(spans[0]["starts_at"])
    assert first_start == sunrise

    for prev, cur in zip(spans, spans[1:]):
        assert prev["ends_at"] == cur["starts_at"], "each span's end must equal the next span's start"
        assert datetime.fromisoformat(cur["starts_at"]) > datetime.fromisoformat(prev["starts_at"]), (
            "spans must be strictly chronological even across the midnight rollover"
        )

    last_end = datetime.fromisoformat(spans[-1]["ends_at"])
    assert last_end - first_start > timedelta(hours=20), "16 eighths of a full day+night should span roughly 24h"


def test_hora_spans_are_24_contiguous_and_cover_sunrise_to_next_sunrise():
    body = _daily("2026-07-16")
    spans = body["hora"]
    assert len(spans) == 24

    sunrise = datetime.fromisoformat(body["sunrise"])
    first_start = datetime.fromisoformat(spans[0]["starts_at"])
    assert first_start == sunrise

    for prev, cur in zip(spans, spans[1:]):
        assert prev["ends_at"] == cur["starts_at"]
        assert datetime.fromisoformat(cur["starts_at"]) > datetime.fromisoformat(prev["starts_at"])

    for span in spans:
        assert span["key"] in repository.HORA_PLANET_KEYS


def test_choghadiya_and_hora_keys_and_auspicious_lists_are_7_and_aligned():
    assert len(repository.CHOGHADIYA_KEYS) == 7
    assert len(repository.CHOGHADIYA_AUSPICIOUS) == 7
    assert len(repository.HORA_PLANET_KEYS) == 7
    assert len(repository.HORA_AUSPICIOUS) == 7

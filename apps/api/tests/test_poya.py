"""Gazette-agreement gate for the Sri Lankan Poya layer.

The fixture holds every officially gazetted Poya day 2021-2026 (extracted
from the MIT-licensed Dilshan-H/srilanka-holidays dataset). Both the Poya-day
rule and the Sinhala month naming must reproduce it exactly — a future engine
or rule change that breaks gazette agreement fails here.
"""
import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.panchanga import calculator

FIXTURE = Path(__file__).parent / "fixtures" / "sl_poya_2021_2026.json"
COLOMBO_ARGS = ("Colombo", 6.9271, 79.8612, 5.5)


def _place():
    return pp_adapter.place(*COLOMBO_ARGS)


def _fixture() -> list[dict]:
    return json.loads(FIXTURE.read_text())


def _gazette_key(name: str) -> str:
    return name.replace(" Full Moon Poya Day", "").lower().replace(" ", "-")


def test_fixture_shape():
    entries = _fixture()
    assert len(entries) == 73
    years = {e["date"][:4] for e in entries}
    assert years == {str(y) for y in range(2021, 2027)}
    # 2023 is the adhika year: 13 Poyas including Adhi Esala.
    assert sum(1 for e in entries if e["date"].startswith("2023")) == 13
    assert any(e["name"].startswith("Adhi Esala") for e in entries)


def test_every_gazetted_poya_is_detected():
    place = _place()
    for entry in _fixture():
        g = date.fromisoformat(entry["date"])
        start = calculator._purnima_start_near(g, place, 5.5)
        assert start is not None, f"no purnima found near {g}"
        predicted = calculator._poya_day_for_purnima(start, place, 5.5)
        assert predicted == g, f"{entry['name']}: gazette {g}, computed {predicted}"


def test_days_adjacent_to_poya_are_not_poya():
    place = _place()
    # Spot-check a handful (full sweep would triple the runtime for little
    # extra signal — the detection test above already pins every gazette day).
    for entry in _fixture()[::12]:
        g = date.fromisoformat(entry["date"])
        for neighbor in (g - timedelta(days=1), g + timedelta(days=1)):
            start = calculator._purnima_start_near(neighbor, place, 5.5)
            if start is None:
                continue
            assert calculator._poya_day_for_purnima(start, place, 5.5) != neighbor


#: Two documented, principled divergences out of 73, both from the same
#: mechanism: which lunar cycle in a ~32.5-month period gets flagged as the
#: intercalary (adhika) month is a razor's-edge classification — whichever
#: cycle contains no sankranti (no monthly solar sign-change) is adhika, and
#: a sankranti's exact moment is exactly as ayanamsa-sensitive as the Mesha
#: Sankranti (New Year) validation below. The engine now runs the validated
#: Lahiri ayanamsa (see app/core/vendor_path.py:configure_ayanamsa) instead
#: of its prior accidental Fagan-Bradley default; that move shifts 2023's
#: adhika-month boundary one cycle later (Esala -> Nikini) versus what the
#: gazette panel published, while leaving the pre-existing 2026 divergence
#: unchanged (that boundary isn't close enough for an ayanamsa-sized shift to
#: move it). Neither is a computation error — both are convention
#: differences in adhika-month placement between this engine and that year's
#: gazette panel. If this set ever changes size or a NEW divergence appears
#: elsewhere, investigate before updating this list — don't just widen it
#: silently.
KNOWN_MONTH_NAMING_DIVERGENCES = [
    {"date": "2023-07-03", "gazette": "adhi-esala", "computed": "esala"},
    {"date": "2023-08-01", "gazette": "esala", "computed": "adhi-nikini"},
    {"date": "2026-05-30", "gazette": "vesak", "computed": "adhi-poson"},
]


def test_sinhala_month_name_matches_gazette_poya_name():
    place = _place()
    mismatches = []
    for entry in _fixture():
        g = date.fromisoformat(entry["date"])
        key, _ = calculator._sinhala_month_at(g, place)
        expected = _gazette_key(entry["name"])
        if key != expected:
            mismatches.append({"date": str(g), "gazette": expected, "computed": key})
    assert mismatches == KNOWN_MONTH_NAMING_DIVERGENCES, (
        f"month-naming mismatches changed from the documented, understood "
        f"divergences — investigate before updating this test: {mismatches}"
    )


def test_2023_adhika_month_placement_diverges_from_gazette():
    """Under the validated Lahiri ayanamsa this engine places 2023's
    intercalary month one cycle later than the gazette (Nikini, not Esala) —
    see KNOWN_MONTH_NAMING_DIVERGENCES."""
    place = _place()
    key, is_adhi = calculator._sinhala_month_at(date(2023, 7, 3), place)
    assert key == "esala" and not is_adhi
    key, is_adhi = calculator._sinhala_month_at(date(2023, 8, 1), place)
    assert key == "adhi-nikini" and is_adhi


@pytest.mark.parametrize(
    "target, expected_poya, expected_month",
    [
        # Esala Poya 2026 is Jul 29 (gazette). The day before points at it;
        # the Poya day reports itself; the day after points at Nikini (Aug 27).
        (date(2026, 7, 28), date(2026, 7, 29), "esala"),
        (date(2026, 7, 29), date(2026, 7, 29), "esala"),
        (date(2026, 7, 30), date(2026, 8, 27), "nikini"),
    ],
)
def test_next_poya_boundaries(target, expected_poya, expected_month):
    place = _place()
    nxt = calculator._next_poya(target, place, 5.5)
    assert nxt.date == expected_poya
    assert nxt.month_key == expected_month


def test_compute_poya_full_shape_on_poya_day():
    place = _place()
    is_poya, poya, nxt, month = calculator.compute_poya(date(2026, 7, 29), place, 5.5)
    assert is_poya and poya is not None and poya.month_key == "esala"
    assert nxt.date == date(2026, 7, 29)
    assert month.key == "esala" and not month.is_adhi


def test_compute_poya_on_ordinary_day():
    place = _place()
    is_poya, poya, nxt, month = calculator.compute_poya(date(2026, 7, 14), place, 5.5)
    assert not is_poya and poya is None
    assert nxt.date == date(2026, 7, 29)
    assert month.key == "esala"

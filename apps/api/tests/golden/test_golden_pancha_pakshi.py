import json
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from app.modules.pancha_pakshi import calculator, repository
from app.modules.pancha_pakshi.enums import PakshaId
from app.modules.pancha_pakshi.models import EngineMetadata, Location

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
FIXTURE_FILES = sorted(FIXTURES_DIR.glob("*.json"))

_ENGINE = EngineMetadata(
    name="PyJHora", version="4.8.7", commit="ca22995709bd60e371e7820a1a5efc80ce4cf821",
    csv_checksum="test", ephemeris_manifest_checksum="test", deployed_commit="test",
)

# Fixture location -> IANA tz used only to resolve a UTC offset that matches the
# fixed tz_hours baked into the fixture (so the calculator's independently
# resolved offset agrees with what upstream was fed).
_TZ_BY_CASE = {
    "waxing_vulture_colombo": "Asia/Colombo",
    "waning_owl_chennai": "Asia/Kolkata",
    "waxing_crow_newyork": "America/New_York",
    "waning_cock_london": "Europe/London",
    "waxing_peacock_sydney": "Australia/Sydney",
    "dst_transition_newyork": "America/New_York",
    "leap_day_colombo": "Asia/Colombo",
}


@pytest.mark.parametrize("fixture_path", FIXTURE_FILES, ids=lambda p: p.stem)
def test_golden_schedule_matches_upstream_rows(fixture_path):
    fixture = json.loads(fixture_path.read_text())
    inp = fixture["input"]
    resolved = fixture["resolved"]
    rows = fixture["rows"]

    birth_bird = repository.BIRD_ORDER[inp["bird_1based"] - 1]
    tz = ZoneInfo(_TZ_BY_CASE[fixture["case_id"]])
    location = Location(
        name=inp["location_name"], latitude=inp["latitude"], longitude=inp["longitude"],
        iana_tz=_TZ_BY_CASE[fixture["case_id"]], utc_offset_minutes=round(inp["tz_hours"] * 60),
    )

    schedule = calculator.compute_schedule(
        inp["year"], inp["month"], inp["day"], inp["hour"], inp["minute"], inp["second"],
        inp["location_name"], inp["latitude"], inp["longitude"], tz,
        birth_bird, location, _ENGINE,
    )

    assert schedule.weekday == repository.WEEKDAY_ORDER[resolved["weekday_index_1based"] - 1]
    assert schedule.paksha == (PakshaId.waxing if resolved["paksha_index_1based"] == 1 else PakshaId.waning)

    flat_sub = [sp for mp in schedule.major_periods for sp in mp.sub_periods]
    assert len(flat_sub) == 50 == len(rows)

    for i, (sp, row) in enumerate(zip(flat_sub, rows)):
        wdi, pi, dni, mbi, mai, sbi, sai, df, reli, pf, efi, rtng, ppi, bpi = row
        assert sp.main_bird == repository.BIRD_ORDER[int(mbi)], f"row {i} main_bird mismatch"
        assert sp.main_activity == repository.ACTIVITY_ORDER[int(mai)], f"row {i} main_activity mismatch"
        assert sp.sub_bird == repository.BIRD_ORDER[int(sbi)], f"row {i} sub_bird mismatch"
        assert sp.sub_activity == repository.ACTIVITY_ORDER[int(sai)], f"row {i} sub_activity mismatch"
        assert sp.relation == repository.RELATION_ORDER[int(reli)], f"row {i} relation mismatch"
        assert sp.effect == repository.EFFECT_ORDER[int(efi)], f"row {i} effect mismatch"
        assert sp.rating == pytest.approx(float(rtng)), f"row {i} rating mismatch"
        assert sp.power_factor == pytest.approx(float(pf)), f"row {i} power_factor mismatch"

    # padu/bharana per major period, from each chunk's row 0
    for major_index, mp in enumerate(schedule.major_periods):
        row0 = rows[major_index * 5]
        assert mp.padu_pakshi == repository.BIRD_ORDER[int(row0[12])]
        assert mp.bharana_pakshi == repository.BIRD_ORDER[int(row0[13])]

    # day/night split: first 5 rows' daynight_index should be 0, last 5 rows' should be 1
    assert all(int(rows[i][2]) == 0 for i in range(0, 25))
    assert all(int(rows[i][2]) == 1 for i in range(25, 50))

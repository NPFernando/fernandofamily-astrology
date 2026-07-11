from datetime import date, time

import pytest

from app.modules.pancha_pakshi.enums import BirdId, PeriodKind, WeekdayId
from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.service import schedule_from_bird

_ENGINE = EngineMetadata(
    version="4.8.7", commit="ca22995709bd60e371e7820a1a5efc80ce4cf821",
    csv_checksum="test", ephemeris_manifest_checksum="test", deployed_commit="test",
)

# 2026-07-12 through 2026-07-18 are Sunday through Saturday, consecutively.
_WEEKDAY_DATES = {
    WeekdayId.sunday: date(2026, 7, 12),
    WeekdayId.monday: date(2026, 7, 13),
    WeekdayId.tuesday: date(2026, 7, 14),
    WeekdayId.wednesday: date(2026, 7, 15),
    WeekdayId.thursday: date(2026, 7, 16),
    WeekdayId.friday: date(2026, 7, 17),
    WeekdayId.saturday: date(2026, 7, 18),
}

_ALL_BIRDS = [BirdId.vulture, BirdId.owl, BirdId.crow, BirdId.cock, BirdId.peacock]


def _assert_structural_invariants(sched):
    assert len(sched.major_periods) == 10
    assert sum(len(mp.sub_periods) for mp in sched.major_periods) == 50
    for mp in sched.major_periods:
        assert len(mp.sub_periods) == 5
    assert all(mp.kind == PeriodKind.day for mp in sched.major_periods[:5])
    assert all(mp.kind == PeriodKind.night for mp in sched.major_periods[5:])
    flat = [sp for mp in sched.major_periods for sp in mp.sub_periods]
    for i in range(len(flat) - 1):
        assert flat[i].ends_at == flat[i + 1].starts_at, f"gap/overlap at sub-period {i}"
    assert sched.major_periods[0].starts_at == sched.sunrise
    assert sched.major_periods[-1].sub_periods[-1].ends_at == sched.next_sunrise
    assert all(sp.duration_seconds > 0 for sp in flat)


@pytest.mark.parametrize("bird", _ALL_BIRDS)
@pytest.mark.parametrize("weekday_id,target_date", list(_WEEKDAY_DATES.items()))
def test_invariants_all_birds_all_weekdays(bird, weekday_id, target_date):
    sched = schedule_from_bird(
        bird, target_date, time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.weekday == weekday_id
    _assert_structural_invariants(sched)


def test_daytime_periods_cover_sunrise_through_sunset():
    sched = schedule_from_bird(
        BirdId.peacock, date(2026, 7, 11), time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.major_periods[0].starts_at == sched.sunrise
    assert sched.major_periods[4].ends_at == sched.sunset


def test_nighttime_periods_cover_sunset_through_next_sunrise():
    sched = schedule_from_bird(
        BirdId.peacock, date(2026, 7, 11), time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.major_periods[5].starts_at == sched.sunset
    assert sched.major_periods[-1].sub_periods[-1].ends_at == sched.next_sunrise

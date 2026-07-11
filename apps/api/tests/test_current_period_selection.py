from datetime import date, time, timedelta

from app.modules.pancha_pakshi.enums import BirdId
from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.service import schedule_from_bird

_ENGINE = EngineMetadata(
    version="4.8.7", commit="ca22995709bd60e371e7820a1a5efc80ce4cf821",
    csv_checksum="test", ephemeris_manifest_checksum="test", deployed_commit="test",
)


def _get_schedule():
    return schedule_from_bird(
        BirdId.peacock, date(2026, 7, 11), time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )


def test_current_period_is_start_inclusive():
    sched = _get_schedule()
    first_sub = sched.major_periods[0].sub_periods[0]
    # Recompute selecting "now" exactly at the first sub-period's start.
    from app.modules.pancha_pakshi.calculator import select_current_and_next

    current, nxt = select_current_and_next(sched, first_sub.starts_at)
    assert current is not None
    assert current.major_index == 0 and current.sub_index == 0
    assert current.is_current is True


def test_current_period_is_end_exclusive():
    sched = _get_schedule()
    from app.modules.pancha_pakshi.calculator import select_current_and_next

    first_sub = sched.major_periods[0].sub_periods[0]
    # Exactly at the boundary (ends_at), the NEXT sub-period should be current, not this one.
    current, nxt = select_current_and_next(sched, first_sub.ends_at)
    assert current is not None
    assert not (current.major_index == 0 and current.sub_index == 0)


def test_next_period_is_chronologically_after_current():
    sched = _get_schedule()
    from app.modules.pancha_pakshi.calculator import select_current_and_next

    mid_of_third_sub = sched.major_periods[0].sub_periods[2].starts_at + timedelta(seconds=1)
    current, nxt = select_current_and_next(sched, mid_of_third_sub)
    assert current is not None
    assert nxt is not None
    assert nxt.starts_at == current.ends_at


def test_now_before_sunrise_returns_no_current_but_first_as_next():
    sched = _get_schedule()
    from app.modules.pancha_pakshi.calculator import select_current_and_next

    before = sched.sunrise - timedelta(hours=1)
    current, nxt = select_current_and_next(sched, before)
    assert current is None
    assert nxt is not None
    assert nxt.major_index == 0 and nxt.sub_index == 0


def test_now_after_next_sunrise_returns_none_for_both():
    sched = _get_schedule()
    from app.modules.pancha_pakshi.calculator import select_current_and_next

    after = sched.next_sunrise + timedelta(hours=1)
    current, nxt = select_current_and_next(sched, after)
    assert current is None
    assert nxt is None

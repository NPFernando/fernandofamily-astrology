from datetime import date, time

import pytest

from app.modules.pancha_pakshi.enums import BirdId
from app.modules.pancha_pakshi.errors import InvalidInputError, SunriseUnavailableError
from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.service import schedule_from_bird

_ENGINE = EngineMetadata(
    version="4.8.7", commit="ca22995709bd60e371e7820a1a5efc80ce4cf821",
    csv_checksum="test", ephemeris_manifest_checksum="test", deployed_commit="test",
)


def test_asia_colombo_timezone():
    sched = schedule_from_bird(
        BirdId.peacock, date(2026, 7, 11), time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.location.iana_tz == "Asia/Colombo"
    assert sched.location.utc_offset_minutes == 330


def test_dst_timezone_does_not_crash_and_resolves_pretransition_offset():
    # America/New_York spring-forward in 2026 is March 8. A request just after
    # local midnight on March 8 rolls back to March 7 (pre-transition, EST).
    sched = schedule_from_bird(
        BirdId.crow, date(2026, 3, 8), time(3, 0, 0), "New York, USA", 40.7128, -74.0060, "America/New_York", _ENGINE,
    )
    assert sched.sunrise.utcoffset().total_seconds() / 3600 == -5.0
    assert len(sched.major_periods) == 10


def test_leap_day_input():
    sched = schedule_from_bird(
        BirdId.owl, date(2028, 2, 29), time(10, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.sunrise.date() in (date(2028, 2, 28), date(2028, 2, 29))


def test_before_sunrise_rolls_back_to_previous_day():
    # Colombo sunrise on 2026-07-11 is ~06:04 local; 05:00 is before it.
    sched = schedule_from_bird(
        BirdId.vulture, date(2026, 7, 11), time(5, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.sunrise.date() == date(2026, 7, 10)


def test_midnight_crossing_schedule_spans_two_calendar_dates():
    sched = schedule_from_bird(
        BirdId.cock, date(2026, 7, 11), time(23, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.sunrise.date() == date(2026, 7, 11)
    assert sched.next_sunrise.date() == date(2026, 7, 12)


def test_invalid_timezone_raises_typed_error():
    with pytest.raises(InvalidInputError):
        schedule_from_bird(
            BirdId.peacock, date(2026, 7, 11), time(12, 0, 0), "Nowhere", 6.9271, 79.8612, "Not/A_Timezone", _ENGINE,
        )


@pytest.mark.parametrize("lat,lon", [(91.0, 79.8612), (-91.0, 79.8612), (6.9271, 181.0), (6.9271, -181.0)])
def test_invalid_coordinates_raise_typed_error(lat, lon):
    with pytest.raises(InvalidInputError):
        schedule_from_bird(BirdId.peacock, date(2026, 7, 11), time(12, 0, 0), "Nowhere", lat, lon, "Asia/Colombo", _ENGINE)


def test_polar_latitude_sunrise_failure_is_controlled_not_silent():
    # High polar latitude in mid-summer (permanent daylight) - sunrise/sunset
    # cannot be reliably calculated by the standard algorithm; must raise a
    # controlled typed error, never crash uncontrolled or silently approximate.
    with pytest.raises((SunriseUnavailableError, InvalidInputError)):
        schedule_from_bird(
            BirdId.peacock, date(2026, 6, 21), time(12, 0, 0), "Near North Pole", 85.0, 0.0, "UTC", _ENGINE,
        )

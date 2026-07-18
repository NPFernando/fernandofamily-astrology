"""Vimshottari Mahadasha timeline from a birth moment.

v1 scope: Mahadasha only (9 major periods spanning the full ~120-year
Vimshottari cycle). See app/modules/dasha/__init__.py for why Antardasha
nesting is deliberately deferred.

Verification note: unlike Birth Chart/Divisional Charts (which had no
vendored test fixture to compare against), this module's underlying engine
call is already golden-tested against an upstream textbook worked example
in tests/test_vendor_dasha_engine.py. tests/test_dasha.py therefore
compares this module's API response against a direct engine call at the
same jd -- same shape as test_birth_chart.py, and for the same reason
that test loosened degree comparisons: an arcsec-scale cross-thread
floating-point effect in the vendored engine (documented in
app.core.vendor_path.configure_ayanamsa's docstring) can shift a Moon-
longitude-derived sub-day balance across a midnight boundary. Lord
sequence and duration_years are unaffected (nakshatra-index / whole-year
dict lookups, not longitude-derived) and are compared exactly;
start_date/end_date use a loose tolerance for the same reason
test_birth_chart.py's degree comparisons do.
"""
from datetime import date as date_type
from datetime import time as time_type
from zoneinfo import ZoneInfo

from app.modules.dasha import adapter
from app.modules.dasha.models import DashaTimeline, MahadashaPeriod
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.panchanga import repository as panchanga_repository


def _add_years(d: date_type, years: int) -> date_type:
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        # d was Feb 29 and target year isn't a leap year.
        return d.replace(year=d.year + years, month=2, day=28)


def compute_dasha_timeline(
    birth_date: date_type,
    birth_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    engine: EngineMetadata,
) -> DashaTimeline:
    adapter.ensure_ayanamsa()
    offset_hours = resolve_utc_offset_hours(birth_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(birth_date.year, birth_date.month, birth_date.day),
        (birth_time.hour, birth_time.minute, birth_time.second),
    )

    _vim_balance, raw_periods = adapter.mahadasha_periods(jd, place)

    start_dates = []
    for lords, (year, month, day, _fractional_hour), _duration_years in raw_periods:
        start_dates.append(date_type(year, month, day))

    periods = []
    for i, (lords, _start, duration_years) in enumerate(raw_periods):
        planet_id = lords[0]
        start_date = start_dates[i]
        if i + 1 < len(raw_periods):
            end_date = start_dates[i + 1]
        else:
            end_date = _add_years(start_date, round(duration_years))
        periods.append(
            MahadashaPeriod(
                key=panchanga_repository.GRAHA_KEYS[planet_id],
                start_date=start_date,
                end_date=end_date,
                duration_years=round(duration_years),
            )
        )

    return DashaTimeline(
        engine=engine,
        location=Location(
            name=location_name,
            latitude=latitude,
            longitude=longitude,
            iana_tz=str(tz),
            utc_offset_minutes=round(offset_hours * 60),
        ),
        birth_date=birth_date,
        birth_time=birth_time,
        periods=periods,
    )

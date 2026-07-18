"""Vimshottari Dasha timeline from a birth moment: 9 Mahadashas spanning
the full ~120-year cycle, each carrying its 9 nested Antardasha/Bhukti
sub-periods (v2; v1 shipped Mahadasha-only).

Both levels are derived from a single ANTARA-depth engine call (81
chronological rows grouped as 9 consecutive Antardashas per Mahadasha):
a Mahadasha's start is its first Antardasha's start and its duration is
the round(sum) of its 9 fractional Antardasha durations, which total
exact whole years. Deeper levels (Pratyantara and below, engine depths
3-6) are not exposed.

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
from app.modules.dasha.models import AntardashaPeriod, DashaTimeline, MahadashaPeriod
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

    _vim_balance, raw_rows = adapter.antardasha_periods(jd, place)

    # Group the 81 chronological rows into 9 consecutive runs by maha lord.
    groups: list[list] = []
    previous_maha_lord = None
    for (maha_lord, antara_lord), (year, month, day, _fh), duration_years in raw_rows:
        start_date = date_type(year, month, day)
        if maha_lord != previous_maha_lord:
            groups.append([])
            previous_maha_lord = maha_lord
        groups[-1].append(((maha_lord, antara_lord), start_date, duration_years))

    # Every antardasha's end is the next one's start (contiguous across
    # mahadasha boundaries too); only the very last needs synthesizing,
    # via the same whole-year arithmetic as the final mahadasha's end.
    all_starts = [start for group in groups for _lords, start, _dur in group]

    periods = []
    for gi, group in enumerate(groups):
        maha_lord = group[0][0][0]
        maha_start = group[0][1]
        maha_duration = round(sum(duration for _lords, _start, duration in group))
        if gi + 1 < len(groups):
            maha_end = groups[gi + 1][0][1]
        else:
            maha_end = _add_years(maha_start, maha_duration)

        antardashas = []
        for ai, ((_maha, antara_lord), antara_start, _duration) in enumerate(group):
            flat_index = sum(len(g) for g in groups[:gi]) + ai
            if flat_index + 1 < len(all_starts):
                antara_end = all_starts[flat_index + 1]
            else:
                antara_end = maha_end
            antardashas.append(
                AntardashaPeriod(
                    key=panchanga_repository.GRAHA_KEYS[antara_lord],
                    start_date=antara_start,
                    end_date=antara_end,
                )
            )

        periods.append(
            MahadashaPeriod(
                key=panchanga_repository.GRAHA_KEYS[maha_lord],
                start_date=maha_start,
                end_date=maha_end,
                duration_years=maha_duration,
                antardashas=antardashas,
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

"""Ashtakavarga (Sarvashtakavarga) at a birth moment.

Verification note: unlike Dasamsa/Saptamsa above (this session's own
independent re-derivations of divisional-chart placement rules), this
feature ships the vendored engine's Ashtakavarga computation directly —
but that vendored function itself already carries a real, book-cited
worked example in its own `if __name__ == "__main__":` block
(vendor/jhora/horoscope/chart/ashtakavarga.py, "Chapter 12.3 ashtaka_varga
_tests, Exercise 22/Chart 7"), which this module's test suite pins as a
regression fixture rather than trusting the vendored call blindly — same
bar as every other feature this session, just satisfied by a citation
already present in the vendored source instead of independent research.
A second, chart-independent invariant (Sarvashtakavarga always totals
337 points, for any birth chart) is swept as an additional guard.
"""
from datetime import date as date_type
from datetime import time as time_type
from zoneinfo import ZoneInfo

from app.modules.ashtakavarga import adapter
from app.modules.ashtakavarga.models import AshtakavargaResult, HousePoints
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.panchanga import repository as panchanga_repository

_D1_FACTOR = 1  # identity factor -- see adapter.dhasavarga's own factor=1 note


def build_chart_with_ascendant(raw_d1_placements: list, ascendant_constellation: int) -> list[str]:
    """The vendored Ashtakavarga function needs Lagna in the same
    house-string chart as the 7 grahas ('L', or appended as '.../L' if
    that house already holds a graha) -- adapter.build_house_to_planet_list
    only covers Sun..Saturn, so Lagna is added here as a small, pure step."""
    chart = list(adapter.build_house_to_planet_list(raw_d1_placements))
    if chart[ascendant_constellation]:
        chart[ascendant_constellation] += "/L"
    else:
        chart[ascendant_constellation] = "L"
    return chart


def compute_ashtakavarga(
    birth_date: date_type,
    birth_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    engine: EngineMetadata,
) -> AshtakavargaResult:
    adapter.ensure_ayanamsa()
    offset_hours = resolve_utc_offset_hours(birth_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(birth_date.year, birth_date.month, birth_date.day),
        (birth_time.hour, birth_time.minute, birth_time.second),
    )

    raw_d1_placements = adapter.dhasavarga(jd, place, _D1_FACTOR)
    ascendant_constellation, _ascendant_degrees = adapter.ascendant_rashi_raw(jd, place)
    chart = build_chart_with_ascendant(raw_d1_placements, ascendant_constellation)

    _binna, samudhaya, _prastara = adapter.get_ashtaka_varga(chart)

    houses = [
        HousePoints(
            rashi_index=index + 1,
            rashi_key=panchanga_repository.RASHI_KEYS[index],
            points=points,
        )
        for index, points in enumerate(samudhaya)
    ]

    return AshtakavargaResult(
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
        ascendant_rashi_index=ascendant_constellation + 1,
        ascendant_rashi_key=panchanga_repository.RASHI_KEYS[ascendant_constellation],
        sarvashtakavarga=houses,
        total_points=sum(samudhaya),
    )

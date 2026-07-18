"""D1 (Rasi) birth chart at a birth moment — the base natal chart.

Verification note: like Divisional Charts, no test fixture exists anywhere
in the vendored engine for a plain D1 chart. Unlike Navamsa (which has real
fractional-degree boundary math worth independently re-deriving), whole-sign
D1 placement is direct arithmetic on two already-used engine calls
(`dhasavarga` at factor 1, `ascendant`), so correctness is verified instead
by cross-checking against `divisional_charts`' own dhasavarga call at factor
1 and against `dasavarga_from_long`'s identity behavior at factor 1 — see
tests/test_birth_chart.py.
"""
from datetime import date as date_type
from datetime import time as time_type
from zoneinfo import ZoneInfo

from app.modules.birth_chart import adapter
from app.modules.birth_chart.models import BirthChart, BirthChartPlacement
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.panchanga import repository as panchanga_repository


def compute_birth_chart(
    birth_date: date_type,
    birth_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    engine: EngineMetadata,
) -> BirthChart:
    adapter.ensure_ayanamsa()
    offset_hours = resolve_utc_offset_hours(birth_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(birth_date.year, birth_date.month, birth_date.day),
        (birth_time.hour, birth_time.minute, birth_time.second),
    )

    raw_placements = adapter.graha_positions(jd, place)
    placements = [
        BirthChartPlacement(
            key=panchanga_repository.GRAHA_KEYS[planet_id],
            rashi_index=constellation + 1,
            rashi_key=panchanga_repository.RASHI_KEYS[constellation],
            degrees=long_in_raasi,
        )
        for planet_id, (constellation, long_in_raasi) in raw_placements
    ]

    ascendant_constellation, ascendant_degrees = adapter.ascendant_rashi(jd, place)

    return BirthChart(
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
        ascendant_degrees=ascendant_degrees,
        placements=placements,
    )

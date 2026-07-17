"""D9 (Navamsa) divisional chart at a birth moment.

Verification note: unlike every other feature this session (ayanamsa
validated against Aluth Avurudu, Poya against 73 gazetted dates, eclipses
against real historical events), no test fixture exists anywhere in the
vendored engine for divisional charts. Correctness was instead verified by
independently re-deriving the classical Navamsa rule from scratch (movable
signs count from themselves, fixed signs from the 9th, dual signs from the
5th; 3 degrees 20 minutes per navamsa within a 30-degree rashi) and sweeping
it against `drik.dasavarga_from_long()` across all 12 rashi types —
confirmed matching everywhere except at exact floating-point navamsa
boundaries (e.g. precisely 20.0 degrees from a rashi start), which is a
measure-zero tie-breaking artifact that never occurs for a real planetary
longitude, not a real disagreement (see tests/test_divisional_charts.py).
"""
from datetime import date as date_type
from datetime import time as time_type
from zoneinfo import ZoneInfo

from app.modules.divisional_charts import adapter
from app.modules.divisional_charts.models import NavamsaChart, NavamsaPlacement
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.panchanga import repository as panchanga_repository

_NAVAMSA_FACTOR = 9


def compute_navamsa_chart(
    birth_date: date_type,
    birth_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    engine: EngineMetadata,
) -> NavamsaChart:
    adapter.ensure_ayanamsa()
    offset_hours = resolve_utc_offset_hours(birth_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(birth_date.year, birth_date.month, birth_date.day),
        (birth_time.hour, birth_time.minute, birth_time.second),
    )

    raw_placements = adapter.dhasavarga(jd, place, _NAVAMSA_FACTOR)
    placements = [
        NavamsaPlacement(
            key=panchanga_repository.GRAHA_KEYS[planet_id],
            rashi_index=constellation + 1,
            rashi_key=panchanga_repository.RASHI_KEYS[constellation],
        )
        for planet_id, (constellation, _long_in_raasi) in raw_placements
    ]

    ascendant_constellation = adapter.ascendant_varga_sign(jd, place, _NAVAMSA_FACTOR)

    return NavamsaChart(
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
        placements=placements,
    )

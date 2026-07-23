"""D9 (Navamsa), D10 (Dasamsa), and D7 (Saptamsa) divisional charts at a
birth moment.

Verification note: unlike every other feature this session (ayanamsa
validated against Aluth Avurudu, Poya against 73 gazetted dates, eclipses
against real historical events), no test fixture exists anywhere in the
vendored engine for divisional charts. Navamsa's correctness was instead
verified by independently re-deriving the classical rule from scratch
(movable signs count from themselves, fixed signs from the 9th, dual signs
from the 5th; 3 degrees 20 minutes per navamsa within a 30-degree rashi)
and sweeping it against `drik.dasavarga_from_long()` across all 12 rashi
types — confirmed matching everywhere except at exact floating-point
navamsa boundaries (e.g. precisely 20.0 degrees from a rashi start), which
is a measure-zero tie-breaking artifact that never occurs for a real
planetary longitude, not a real disagreement (see
tests/test_divisional_charts.py).

Dasamsa (2026-07-23) does NOT reuse that same generic vendor path — a
numeric sweep found `dasavarga_from_long(lon, 10)` disagrees with the
classical odd/even Dasamsa rule for 9 of 12 signs (it only coincidentally
matches Navamsa's and Saptamsa's specific sign-quality symmetry, not
Dasamsa's). `_dasamsa_constellation` below hand-implements the classical
rule directly instead, verified against a real worked example. See its
own docstring for the full derivation.

Saptamsa (2026-07-23) DOES safely reuse the generic vendor path — its
own classical odd/even symmetry was independently verified to coincide
with `dasavarga_from_long`'s generic formula (0 mismatches across all 12
signs), unlike Dasamsa's. See `compute_saptamsa_chart`'s own docstring."""
from datetime import date as date_type
from datetime import time as time_type
from zoneinfo import ZoneInfo

from app.modules.divisional_charts import adapter
from app.modules.divisional_charts.models import (
    DasamsaChart,
    DasamsaPlacement,
    NavamsaChart,
    NavamsaPlacement,
    SaptamsaChart,
    SaptamsaPlacement,
)
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.panchanga import repository as panchanga_repository

_NAVAMSA_FACTOR = 9
_SAPTAMSA_FACTOR = 7
_D1_FACTOR = 1  # identity factor -- see adapter.dhasavarga's own factor=1 note
_DASAMSA_DIVISIONS = 10
_DASAMSA_DIVISION_WIDTH = 30.0 / _DASAMSA_DIVISIONS  # 3 degrees


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


def compute_saptamsa_chart(
    birth_date: date_type,
    birth_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    engine: EngineMetadata,
) -> SaptamsaChart:
    """D7 Saptamsa. Unlike Dasamsa below, this DOES reuse the generic
    `adapter.dhasavarga`/`ascendant_varga_sign` vendor path — verified
    (2026-07-23) by sweeping the classical odd/even Saptamsa rule (odd
    signs count from themselves; even signs count from the 7th sign
    counted inclusively from themselves) against `dasavarga_from_long(lon,
    7)` across all 12 signs x 7 divisions: 0 mismatches. Saptamsa's
    odd/even symmetry happens to coincide with the generic formula the
    same way Navamsa's movable/fixed/dual symmetry does; Dasamsa's does
    not (see its own docstring) — this is confirmed per-varga, not
    assumed from Navamsa's or Saptamsa's result alone."""
    adapter.ensure_ayanamsa()
    offset_hours = resolve_utc_offset_hours(birth_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(birth_date.year, birth_date.month, birth_date.day),
        (birth_time.hour, birth_time.minute, birth_time.second),
    )

    raw_placements = adapter.dhasavarga(jd, place, _SAPTAMSA_FACTOR)
    placements = [
        SaptamsaPlacement(
            key=panchanga_repository.GRAHA_KEYS[planet_id],
            rashi_index=constellation + 1,
            rashi_key=panchanga_repository.RASHI_KEYS[constellation],
        )
        for planet_id, (constellation, _long_in_raasi) in raw_placements
    ]

    ascendant_constellation = adapter.ascendant_varga_sign(jd, place, _SAPTAMSA_FACTOR)

    return SaptamsaChart(
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


def _dasamsa_constellation(rashi_index_0based: int, degrees_in_rashi: float) -> int:
    """Classical Parashari Dasamsa (D10) placement — deliberately NOT the
    generic `adapter.dhasavarga(..., 10)` / `dasavarga_from_long(lon, 10)`
    vendor path used for Navamsa above. That generic formula is a pure
    repeating 12-sign cycle across the whole zodiac; it happens to
    reproduce the classical rule for Navamsa (factor 9) and Saptamsa
    (factor 7) because of those factors' specific movable/fixed/dual or
    odd/even symmetry, but NOT for Dasamsa — verified numerically
    (2026-07-23) by sweeping all 12 signs' first division through both
    formulas: 9 of 12 signs disagreed (e.g. the generic path places
    Taurus's 1st dasamsa in Aquarius; the classical rule — confirmed
    against a worked example, "2 deg Taurus falls in Capricorn in the
    D10" — places it in Capricorn). See tests/test_divisional_charts.py
    for the same sweep as a regression guard.

    Rule: odd signs (1-based Aries=1, Gemini=3, Leo=5, Libra=7,
    Sagittarius=9, Aquarius=11) start their 10 divisions from themselves;
    even signs start from the 9th sign counted inclusively from
    themselves (index + 8, mod 12). Division k (1..10, by 3-degree
    steps) then counts forward cyclically from that start."""
    division_0based = int(degrees_in_rashi / _DASAMSA_DIVISION_WIDTH)
    is_odd_sign = (rashi_index_0based + 1) % 2 == 1
    start = rashi_index_0based if is_odd_sign else (rashi_index_0based + 8) % 12
    return (start + division_0based) % 12


def compute_dasamsa_chart(
    birth_date: date_type,
    birth_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    engine: EngineMetadata,
) -> DasamsaChart:
    adapter.ensure_ayanamsa()
    offset_hours = resolve_utc_offset_hours(birth_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(birth_date.year, birth_date.month, birth_date.day),
        (birth_time.hour, birth_time.minute, birth_time.second),
    )

    # Factor 1 is the identity D1/Rasi projection (see adapter.dhasavarga's
    # own note on this) -- gives raw (rashi, degrees-in-rashi) per graha,
    # which _dasamsa_constellation then transforms with the classical
    # odd/even rule rather than the generic vendor varga path.
    raw_d1_placements = adapter.dhasavarga(jd, place, _D1_FACTOR)
    placements = [
        DasamsaPlacement(
            key=panchanga_repository.GRAHA_KEYS[planet_id],
            rashi_index=_dasamsa_constellation(constellation, long_in_raasi) + 1,
            rashi_key=panchanga_repository.RASHI_KEYS[_dasamsa_constellation(constellation, long_in_raasi)],
        )
        for planet_id, (constellation, long_in_raasi) in raw_d1_placements
    ]

    asc_constellation, asc_coordinates = adapter.ascendant_rashi_raw(jd, place)
    ascendant_dasamsa = _dasamsa_constellation(asc_constellation, asc_coordinates)

    return DasamsaChart(
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
        ascendant_rashi_index=ascendant_dasamsa + 1,
        ascendant_rashi_key=panchanga_repository.RASHI_KEYS[ascendant_dasamsa],
        placements=placements,
    )

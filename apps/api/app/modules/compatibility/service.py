from collections import Counter
from datetime import date as date_type
from datetime import time as time_type
from zoneinfo import ZoneInfo

from jhora import const
from jhora.panchanga import drik

from app.modules.compatibility.models import (
    CompatibilityResponse,
    RelationVariant,
    VivahaChakraNakshatra,
    VivahaChakraResponse,
    VivahaChakraVerdictKey,
)
from app.modules.pancha_pakshi.enums import BirdId, RelationId
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.pancha_pakshi import repository as pancha_repository
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi import validation
from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours
from app.modules.panchanga import adapter as panchanga_adapter
from app.modules.panchanga import repository as panchanga_repository


_VIVAHA_VERDICT_KEYS: list[VivahaChakraVerdictKey] = [
    "family_damage",
    "wealthy_blessed",
    "bride_family_damage",
    "poverty_cursed",
    "gainful_beneficial",
    "reputation_loss",
    "bride_devastating",
    "successful",
    "wonderful_blessed",
]
_SUPPORTIVE_VERDICTS = {2, 5, 8, 9}


def bird_compatibility(bird_a: BirdId, bird_b: BirdId) -> CompatibilityResponse:
    a_index = pancha_repository.BIRD_ORDER.index(bird_a)
    b_index = pancha_repository.BIRD_ORDER.index(bird_b)
    counts: Counter[RelationId] = Counter()

    for row in pancha_repository.load_rows():
        row_main_bird = int(row[3])
        row_sub_bird = int(row[5])
        if (row_main_bird, row_sub_bird) == (a_index, b_index):
            counts[pancha_repository.RELATION_ORDER[int(row[8])]] += 1
        elif a_index != b_index and (row_main_bird, row_sub_bird) == (b_index, a_index):
            counts[pancha_repository.RELATION_ORDER[int(row[8])]] += 1

    variants = [
        RelationVariant(relation=relation, count=counts[relation])
        for relation in pancha_repository.RELATION_ORDER
        if counts[relation] > 0
    ]
    if not variants:
        raise AssertionError(f"no compatibility rows for {bird_a} + {bird_b}")

    dominant = max(
        variants,
        key=lambda item: (item.count, pancha_repository.RELATION_ORDER.index(item.relation)),
    ).relation

    return CompatibilityResponse(
        bird_a=bird_a,
        bird_b=bird_b,
        relation=dominant,
        context_dependent=len(variants) > 1,
        sample_size=sum(item.count for item in variants),
        variants=variants,
    )


def _nakshatra_for_body(jd: float, body: int, place) -> VivahaChakraNakshatra:
    # sidereal_longitude() requires genuine UT input per its own docstring
    # ("JD_UTC = JD - place.timezone") — jd here is this app's usual
    # local-embedded convention, so it must be converted before use (see
    # _vivaha_chakra_verdict_index's docstring for why this matters and how
    # it was found).
    jd_utc = jd - place.timezone / 24
    raw = drik.nakshatra_pada(drik.sidereal_longitude(jd_utc, body))
    index = int(raw[0])
    return VivahaChakraNakshatra(
        key=panchanga_repository.NAKSHATRA_KEYS[index - 1],
        index=index,
        pada=int(raw[1]),
    )


def _vivaha_chakra_verdict_index(jd: float, place) -> int:
    """Corrected reimplementation of drik.vivaha_chakra_palan(): the vendored
    function computes `jd_utc = jd - place.timezone/24` but never actually
    uses it — it passes the raw local-embedded `jd` to sidereal_longitude()
    for both Sun and Moon, even though sidereal_longitude()'s own docstring
    requires genuine UT input. Since every request this Sri-Lanka-focused
    app makes carries the same +5:30 offset, this was a constant systematic
    bias on every query, not a rare edge case: confirmed via direct
    reproduction that the Moon's ~3-degree motion over 5.5 hours frequently
    crosses a nakshatra boundary between the buggy and correct computation,
    and 10% of sampled dates produced a completely different (sometimes
    opposite-polarity, e.g. "wonderful pair and blessed" vs "collateral
    damage to family") final verdict. Ported faithfully from
    drik.vivaha_chakra_palan with that one line fixed, per this project's
    established policy of working around vendored bugs in our own layer
    rather than patching vendored files.
    """
    jd_utc = jd - place.timezone / 24
    sun_star = drik.nakshatra_pada(drik.sidereal_longitude(jd_utc, const._SUN))[0]
    moon_star = drik.nakshatra_pada(drik.sidereal_longitude(jd_utc, const._MOON))[0]

    grid = [[[(sun_star + (i + j) - 1) % 27 + 1 for j in range(-1, 2)] for i in range(-1, 2)] for _ in range(3)]
    positions = [(1, 2), (2, 2), (2, 1), (2, 0), (1, 0), (0, 0), (0, 1), (0, 2)]
    all_stars = [(sun_star + i - 2) % 27 + 1 for i in range(27)]
    for i, (r, c) in enumerate(positions):
        grid[r][c] = all_stars[3 * (i + 1) : 3 * (i + 2)]

    r, c = next((i, j) for i in range(3) for j in range(3) if moon_star in grid[i][j])
    mapping = {(1, 1): 1, (1, 2): 2, (2, 2): 3, (2, 1): 4, (2, 0): 5, (1, 0): 6, (0, 0): 7, (0, 1): 8, (0, 2): 9}
    return mapping[(r, c)]


def vivaha_chakra(
    target_date: date_type,
    target_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    engine: EngineMetadata,
) -> VivahaChakraResponse:
    validation.validate_supported_date(target_date)
    panchanga_adapter.ensure_ayanamsa()
    offset_hours = resolve_utc_offset_hours(target_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(target_date.year, target_date.month, target_date.day),
        (target_time.hour, target_time.minute, target_time.second),
    )
    verdict_index = _vivaha_chakra_verdict_index(jd, place)
    return VivahaChakraResponse(
        engine=engine,
        location=Location(
            name=location_name,
            latitude=latitude,
            longitude=longitude,
            iana_tz=str(tz.key),
            utc_offset_minutes=round(offset_hours * 60),
        ),
        date=target_date,
        time=target_time,
        verdict_index=verdict_index,
        verdict_key=_VIVAHA_VERDICT_KEYS[verdict_index - 1],
        tone="supportive" if verdict_index in _SUPPORTIVE_VERDICTS else "caution",
        sun_nakshatra=_nakshatra_for_body(jd, const._SUN, place),
        moon_nakshatra=_nakshatra_for_body(jd, const._MOON, place),
    )

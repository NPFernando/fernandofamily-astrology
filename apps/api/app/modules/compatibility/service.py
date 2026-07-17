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


def _nakshatra_for_body(jd: float, body: int) -> VivahaChakraNakshatra:
    raw = drik.nakshatra_pada(drik.sidereal_longitude(jd, body))
    index = int(raw[0])
    return VivahaChakraNakshatra(
        key=panchanga_repository.NAKSHATRA_KEYS[index - 1],
        index=index,
        pada=int(raw[1]),
    )


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
    verdict_index = int(drik.vivaha_chakra_palan(jd, place))
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
        sun_nakshatra=_nakshatra_for_body(jd, const._SUN),
        moon_nakshatra=_nakshatra_for_body(jd, const._MOON),
    )

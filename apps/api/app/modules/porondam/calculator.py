"""Pure classification logic for the 7 shipped Porondama — no ephemeris
calls here; all inputs are the birth nakshatra (1..27) and rashi (1..12)
this app already resolves correctly elsewhere (birth_nakshatra module,
Tara Bala, divisional charts)."""
from datetime import date as date_type
from datetime import time as time_type
from zoneinfo import ZoneInfo

from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours
from app.modules.pancha_pakshi.models import Location
from app.modules.panchanga import repository as panchanga_repository
from app.modules.porondam import repository
from app.modules.porondam.models import PartyDetails, PorondamMatch, PorondamResult

# Classical Tara/Nakshatra-Kuta counting: from vendor/jhora/utils.py:905's
# `count_stars = lambda from_star,to_star,direction=1,total=27: ((total +
# direction*(to_star-from_star)) % total)+1`, and drik.py:3524's own
# `good_tharaabalam = [0,2,4,6,8]` classification (the same 9-category
# system already used by this session's Tara Bala feature, repository.
# TARA_KEYS/TARA_EFFECT_ORDER in pancha_pakshi — reused here as a pure
# nakshatra-to-nakshatra count rather than birth-star-vs-today's-Moon).
_GOOD_TARA_CATEGORIES = frozenset({0, 2, 4, 6, 8})


def _count_stars(from_star: int, to_star: int, total: int = 27) -> int:
    return ((total + (to_star - from_star)) % total) + 1


def _tara_category(from_star: int, to_star: int) -> int:
    return _count_stars(from_star, to_star) % 9


def compute_nakshatra_porondam(nakshatra_a: int, nakshatra_b: int) -> PorondamMatch:
    """Checked in both directions (bride->groom and groom->bride) — passes
    only if neither direction's tārā category falls outside the classical
    "good" set."""
    forward = _tara_category(nakshatra_a, nakshatra_b)
    backward = _tara_category(nakshatra_b, nakshatra_a)
    passed = forward in _GOOD_TARA_CATEGORIES and backward in _GOOD_TARA_CATEGORIES
    return PorondamMatch(key="nakshatra", passed=passed)


def compute_gana_porondam(nakshatra_a: int, nakshatra_b: int) -> PorondamMatch:
    gana_a = repository.GANA_BY_NAKSHATRA[nakshatra_a - 1]
    gana_b = repository.GANA_BY_NAKSHATRA[nakshatra_b - 1]
    return PorondamMatch(key="gana", passed=repository.gana_compatible(gana_a, gana_b))


def compute_yoni_porondam(nakshatra_a: int, nakshatra_b: int) -> PorondamMatch:
    yoni_a = repository.YONI_KEYS[repository.YONI_BY_NAKSHATRA[nakshatra_a - 1]]
    yoni_b = repository.YONI_KEYS[repository.YONI_BY_NAKSHATRA[nakshatra_b - 1]]
    return PorondamMatch(key="yoni", passed=repository.yoni_compatible(yoni_a, yoni_b))


def compute_rashi_porondam(rashi_a: int, rashi_b: int) -> PorondamMatch:
    return PorondamMatch(key="rashi", passed=repository.rashi_compatible(rashi_a, rashi_b))


def compute_rashyadpathi_porondam(rashi_a: int, rashi_b: int) -> PorondamMatch:
    lord_a = repository.RASHI_LORDS[rashi_a - 1]
    lord_b = repository.RASHI_LORDS[rashi_b - 1]
    return PorondamMatch(key="rashyadpathi", passed=repository.rashyadpathi_compatible(lord_a, lord_b))


def compute_vashya_porondam(rashi_a: int, rashi_b: int) -> PorondamMatch:
    vashya_a = repository.VASHYA_BY_RASHI[rashi_a - 1]
    vashya_b = repository.VASHYA_BY_RASHI[rashi_b - 1]
    return PorondamMatch(key="vashya", passed=repository.vashya_compatible(vashya_a, vashya_b))


def compute_vedha_porondam(nakshatra_a: int, nakshatra_b: int) -> PorondamMatch:
    return PorondamMatch(key="vedha", passed=repository.vedha_compatible(nakshatra_a, nakshatra_b))


def resolve_party(
    birth_date: date_type,
    birth_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
) -> PartyDetails:
    """Same birth-resolution pattern as birth_nakshatra.service — reuses
    the already-correct nakshatra/rashi resolution, no new ephemeris logic."""
    pp_adapter.ensure_ayanamsa()
    offset_hours = resolve_utc_offset_hours(birth_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(birth_date.year, birth_date.month, birth_date.day),
        (birth_time.hour, birth_time.minute, birth_time.second),
    )
    nakshatra_index = int(pp_adapter.nakshatra_with_pada(jd, place)[0])
    rashi_index = pp_adapter.natal_moon_rashi_1based(jd, place)
    return PartyDetails(
        location=Location(
            name=location_name,
            latitude=latitude,
            longitude=longitude,
            iana_tz=str(tz),
            utc_offset_minutes=round(offset_hours * 60),
        ),
        nakshatra_index=nakshatra_index,
        nakshatra_key=panchanga_repository.NAKSHATRA_KEYS[nakshatra_index - 1],
        rashi_index=rashi_index,
        rashi_key=panchanga_repository.RASHI_KEYS[rashi_index - 1],
    )


def compute_porondam(nakshatra_a: int, rashi_a: int, nakshatra_b: int, rashi_b: int) -> PorondamResult:
    matches = [
        compute_nakshatra_porondam(nakshatra_a, nakshatra_b),
        compute_gana_porondam(nakshatra_a, nakshatra_b),
        compute_yoni_porondam(nakshatra_a, nakshatra_b),
        compute_rashi_porondam(rashi_a, rashi_b),
        compute_rashyadpathi_porondam(rashi_a, rashi_b),
        compute_vashya_porondam(rashi_a, rashi_b),
        compute_vedha_porondam(nakshatra_a, nakshatra_b),
    ]
    passed_count = sum(1 for m in matches if m.passed)
    return PorondamResult(matches=matches, passed_count=passed_count, checked_count=len(matches))

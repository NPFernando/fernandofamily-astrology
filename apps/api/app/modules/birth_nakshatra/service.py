from app.modules.birth_nakshatra.models import (
    BirthNakshatraDetails,
    BirthNakshatraResponse,
    MoonRashi,
)
from app.modules.birth_nakshatra.repository import rashi_key
from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi import calculator as pp_calculator
from app.modules.pancha_pakshi import repository as pp_repository
from app.modules.pancha_pakshi import validation
from app.modules.pancha_pakshi.enums import PakshaId
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.panchanga import repository as panchanga_repository
from app.modules.birth_nakshatra.requests import BirthNakshatraRequest


def resolve_birth_nakshatra(
    request: BirthNakshatraRequest,
    engine: EngineMetadata,
) -> BirthNakshatraResponse:
    tz = validation.validate_location(request.latitude, request.longitude, request.iana_tz)
    validation.validate_supported_date(request.birth_date, "birth_date")
    pp_adapter.ensure_ayanamsa()

    offset_hours = pp_calculator.resolve_utc_offset_hours(request.birth_date, tz)
    place = pp_adapter.place(request.location_name, request.latitude, request.longitude, offset_hours)
    jd = pp_adapter.julian_day_number(
        pp_adapter.date(request.birth_date.year, request.birth_date.month, request.birth_date.day),
        (request.birth_time.hour, request.birth_time.minute, request.birth_time.second),
    )

    raw_nakshatra = pp_adapter.nakshatra_with_pada(jd, place)
    nakshatra_index = int(raw_nakshatra[0])
    pada = int(raw_nakshatra[1])
    paksha_1based = pp_adapter.paksha_index_1based(jd, place)
    moon_rashi_index = pp_adapter.natal_moon_rashi_1based(jd, place)
    birth_bird_1based = pp_adapter.birth_bird_1based(nakshatra_index, paksha_1based)

    return BirthNakshatraResponse(
        engine=engine,
        location=Location(
            name=request.location_name,
            latitude=request.latitude,
            longitude=request.longitude,
            iana_tz=request.iana_tz,
            utc_offset_minutes=round(offset_hours * 60),
        ),
        nakshatra=BirthNakshatraDetails(
            index=nakshatra_index,
            key=panchanga_repository.NAKSHATRA_KEYS[nakshatra_index - 1],
            pada=pada,
        ),
        paksha=PakshaId.waxing if paksha_1based == 1 else PakshaId.waning,
        moon_rashi=MoonRashi(index=moon_rashi_index, key=rashi_key(moon_rashi_index)),
        birth_bird=pp_repository.BIRD_ORDER[birth_bird_1based - 1],
    )

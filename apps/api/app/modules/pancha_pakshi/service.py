from datetime import date as date_type
from datetime import time as time_type

from app.modules.pancha_pakshi import calculator, repository, validation
from app.modules.pancha_pakshi.enums import BirdId, PakshaId
from app.modules.pancha_pakshi.models import EngineMetadata, Location, ScheduleResponse


def _location_model(name: str, latitude: float, longitude: float, iana_tz: str, offset_hours: float) -> Location:
    return Location(
        name=name,
        latitude=latitude,
        longitude=longitude,
        iana_tz=iana_tz,
        utc_offset_minutes=round(offset_hours * 60),
    )


def schedule_from_birth_datetime(
    birth_date: date_type,
    birth_time: time_type,
    target_date: date_type,
    target_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    iana_tz: str,
    engine: EngineMetadata,
) -> ScheduleResponse:
    tz = validation.validate_location(latitude, longitude, iana_tz)
    validation.validate_supported_date(birth_date, "birth_date")
    validation.validate_supported_date(target_date, "target_date")
    birth_bird, birth_nakshatra_index = calculator.compute_birth_bird(
        birth_date.year,
        birth_date.month,
        birth_date.day,
        birth_time.hour,
        birth_time.minute,
        birth_time.second,
        location_name,
        latitude,
        longitude,
        tz,
    )
    _, _, offset_hours, _ = calculator.resolve_effective_jd(
        target_date.year, target_date.month, target_date.day, target_time.hour, target_time.minute, target_time.second,
        location_name, latitude, longitude, tz,
    )
    location = _location_model(location_name, latitude, longitude, iana_tz, offset_hours)
    return calculator.compute_schedule(
        target_date.year,
        target_date.month,
        target_date.day,
        target_time.hour,
        target_time.minute,
        target_time.second,
        location_name,
        latitude,
        longitude,
        tz,
        birth_bird,
        location,
        engine,
        birth_nakshatra_index=birth_nakshatra_index,
    )


def schedule_from_nakshatra_paksha(
    nakshatra_index: int,
    paksha: PakshaId,
    target_date: date_type,
    target_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    iana_tz: str,
    engine: EngineMetadata,
) -> ScheduleResponse:
    validation.validate_nakshatra_index(nakshatra_index)
    tz = validation.validate_location(latitude, longitude, iana_tz)
    validation.validate_supported_date(target_date, "target_date")
    paksha_column = 0 if paksha == PakshaId.waxing else 1
    bird_1based = repository.BIRTH_BIRD_TABLE[nakshatra_index - 1][paksha_column]
    birth_bird = repository.BIRD_ORDER[bird_1based - 1]
    _, _, offset_hours, _ = calculator.resolve_effective_jd(
        target_date.year, target_date.month, target_date.day, target_time.hour, target_time.minute, target_time.second,
        location_name, latitude, longitude, tz,
    )
    location = _location_model(location_name, latitude, longitude, iana_tz, offset_hours)
    return calculator.compute_schedule(
        target_date.year,
        target_date.month,
        target_date.day,
        target_time.hour,
        target_time.minute,
        target_time.second,
        location_name,
        latitude,
        longitude,
        tz,
        birth_bird,
        location,
        engine,
        birth_nakshatra_index=nakshatra_index,
    )


def schedule_from_bird(
    bird: BirdId,
    target_date: date_type,
    target_time: time_type,
    location_name: str,
    latitude: float,
    longitude: float,
    iana_tz: str,
    engine: EngineMetadata,
) -> ScheduleResponse:
    tz = validation.validate_location(latitude, longitude, iana_tz)
    validation.validate_supported_date(target_date, "target_date")
    _, _, offset_hours, _ = calculator.resolve_effective_jd(
        target_date.year, target_date.month, target_date.day, target_time.hour, target_time.minute, target_time.second,
        location_name, latitude, longitude, tz,
    )
    location = _location_model(location_name, latitude, longitude, iana_tz, offset_hours)
    return calculator.compute_schedule(
        target_date.year,
        target_date.month,
        target_date.day,
        target_time.hour,
        target_time.minute,
        target_time.second,
        location_name,
        latitude,
        longitude,
        tz,
        bird,
        location,
        engine,
    )


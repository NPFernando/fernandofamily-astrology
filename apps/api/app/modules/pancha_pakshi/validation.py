from zoneinfo import ZoneInfo, available_timezones

from app.modules.pancha_pakshi.enums import PakshaId
from app.modules.pancha_pakshi.errors import InvalidInputError

_VALID_TIMEZONES = available_timezones()


def validate_latitude(value: float) -> None:
    if not (-90.0 <= value <= 90.0):
        raise InvalidInputError(f"latitude must be between -90 and 90, got {value}")


def validate_longitude(value: float) -> None:
    if not (-180.0 <= value <= 180.0):
        raise InvalidInputError(f"longitude must be between -180 and 180, got {value}")


def validate_iana_timezone(value: str) -> ZoneInfo:
    if value not in _VALID_TIMEZONES:
        raise InvalidInputError(f"'{value}' is not a recognized IANA timezone")
    return ZoneInfo(value)


def validate_nakshatra_index(value: int) -> None:
    if not (1 <= value <= 27):
        raise InvalidInputError(f"nakshatra_index must be between 1 and 27, got {value}")


def validate_paksha(value: str) -> PakshaId:
    try:
        return PakshaId(value)
    except ValueError as exc:
        raise InvalidInputError(f"'{value}' is not a valid paksha (expected 'waxing' or 'waning')") from exc


def validate_location(latitude: float, longitude: float, iana_tz: str) -> ZoneInfo:
    validate_latitude(latitude)
    validate_longitude(longitude)
    return validate_iana_timezone(iana_tz)

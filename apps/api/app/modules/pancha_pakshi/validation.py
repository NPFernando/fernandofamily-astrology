import os
from datetime import date as date_type
from zoneinfo import ZoneInfo, available_timezones

from app.modules.pancha_pakshi.enums import PakshaId
from app.modules.pancha_pakshi.errors import InvalidInputError

_VALID_TIMEZONES = available_timezones()

# The Docker image ships only the 1800-2399 ephemeris files (see
# vendor/README.md); outside that range swisseph does NOT raise — it silently
# falls back to its built-in lower-precision theory, which would violate the
# platform's no-silent-approximation rule. So under the image profile,
# out-of-range dates are rejected with a controlled error instead. A full
# checkout (repo profile) has the complete 5,400-year data and no such bound.
_IMAGE_PROFILE = os.environ.get("FF_VENDOR_PROFILE") == "image"
_IMAGE_MIN_DATE = date_type(1800, 1, 1)
_IMAGE_MAX_DATE = date_type(2399, 12, 31)


def validate_supported_date(value: date_type, field: str = "date") -> None:
    if _IMAGE_PROFILE and not (_IMAGE_MIN_DATE <= value <= _IMAGE_MAX_DATE):
        raise InvalidInputError(
            f"{field} must be between {_IMAGE_MIN_DATE.isoformat()} and "
            f"{_IMAGE_MAX_DATE.isoformat()} (supported ephemeris range), got {value.isoformat()}"
        )


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

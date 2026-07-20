import os
from datetime import date as date_type
from zoneinfo import ZoneInfo, available_timezones

from app.modules.pancha_pakshi.enums import PakshaId
from app.modules.pancha_pakshi.errors import InvalidInputError

_VALID_TIMEZONES = available_timezones()

# The Docker image ships only the 1200-2399 ephemeris files (see
# vendor/README.md); outside that range swisseph does NOT raise — it silently
# falls back to its built-in lower-precision theory, which would violate the
# platform's no-silent-approximation rule. So under the image profile,
# out-of-range dates are rejected with a controlled error instead. A full
# checkout (repo profile) has the complete 5,400-year data and no such bound.
#
# The lower bound was 1800 until the historical/ancestor-charts widening
# (2026-07-20) added the sepl_12/semo_12 pair (1200-1799 CE, ~1.8 MB) to the
# image. Two semantics that come with pre-1800 dates, documented on the
# methodology page rather than handled in code because both are already
# correct as-is: (1) input dates are interpreted as proleptic GREGORIAN
# (swe.julday's default) — fine for Sri Lankan genealogy, whose record eras
# (Portuguese/Dutch/British) were effectively Gregorian throughout, but a
# date transcribed from a Julian-calendar source must be converted by the
# user first; (2) for dates before standardized time, zoneinfo returns the
# IANA tzdb's Local Mean Time offset (e.g. Asia/Colombo 1750 -> +5:19:24),
# which is the astronomically correct pre-standard-time offset.
_IMAGE_PROFILE = os.environ.get("FF_VENDOR_PROFILE") == "image"
_IMAGE_MIN_DATE = date_type(1200, 1, 1)
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


def validate_moon_rashi_index(value: int) -> None:
    if not (1 <= value <= 12):
        raise InvalidInputError(f"moon_rashi_index must be between 1 and 12, got {value}")


def validate_paksha(value: str) -> PakshaId:
    try:
        return PakshaId(value)
    except ValueError as exc:
        raise InvalidInputError(f"'{value}' is not a valid paksha (expected 'waxing' or 'waning')") from exc


def validate_location(latitude: float, longitude: float, iana_tz: str) -> ZoneInfo:
    validate_latitude(latitude)
    validate_longitude(longitude)
    return validate_iana_timezone(iana_tz)

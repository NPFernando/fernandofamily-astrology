"""Sole boundary permitted to import vendored `jhora`. Thin pass-throughs only —
no enums, no business logic, and never touches utils.set_language/resource_strings
or any image path, since those are upstream UI/localization concerns this
platform's adapter must not depend on.
"""
import os
import sys
from pathlib import Path

# FF_VENDOR_DIR overrides where the vendored engine lives — used by tests to
# point at an ephemeris-trimmed copy of the tree, mirroring what the Docker
# image ships (see infra/docker/Dockerfile.api and vendor/README.md).
_VENDOR_PATH = os.environ.get("FF_VENDOR_DIR") or str(Path(__file__).resolve().parents[3] / "vendor")
if _VENDOR_PATH not in sys.path:
    sys.path.insert(0, _VENDOR_PATH)

from jhora import utils  # noqa: E402
from jhora.panchanga import drik, pancha_paksha  # noqa: E402


def place(name: str, latitude: float, longitude: float, tz_hours: float):
    return drik.Place(name, latitude, longitude, tz_hours)


def date(year: int, month: int, day: int):
    return drik.Date(year, month, day)


def julian_day_number(dob, tob: tuple[int, int, int]) -> float:
    return utils.julian_day_number(dob, tob)


def sunrise(jd: float, p) -> tuple:
    return drik.sunrise(jd, p)


def sunset(jd: float, p) -> tuple:
    return drik.sunset(jd, p)


def day_length(jd: float, p) -> float:
    """Hours."""
    return drik.day_length(jd, p)


def night_length(jd: float, p) -> float:
    """Hours."""
    return drik.night_length(jd, p)


def weekday_index_0based(jd: float, p) -> int:
    return drik.vaara(jd, p, show_vedic_day=True)


def paksha_index_1based(jd: float, p) -> int:
    return pancha_paksha._get_paksha(jd, p)


def nakshatra_index_1based(jd: float, p) -> int:
    return drik.nakshatra(jd, p)[0]


def birth_bird_1based(nakshatra_1based: int, paksha_1based: int) -> int:
    return pancha_paksha._get_birth_bird_from_nakshathra(nakshatra_1based, paksha_1based)


def matching_rows(bird_1based: int, weekday_1based: int, paksha_1based: int) -> list[list]:
    return pancha_paksha.get_matching_pancha_pakshi_data_from_db(bird_1based, weekday_1based, paksha_1based)


def jd_to_gregorian(jd: float) -> tuple[int, int, int, float]:
    """Returns (year, month, day, fractional_hour) in the same local wall-clock
    time embedded in `jd` by the Place passed to the function that produced it
    (e.g. sunrise/sunset) — no further timezone conversion needed by callers.
    """
    return utils.jd_to_gregorian(jd)

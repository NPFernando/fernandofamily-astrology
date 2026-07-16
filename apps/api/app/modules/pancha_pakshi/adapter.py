"""Sole boundary permitted to import vendored `jhora`. Thin pass-throughs only —
no enums, no business logic, and never touches utils.set_language/resource_strings
or any image path, since those are upstream UI/localization concerns this
platform's adapter must not depend on.
"""
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

from jhora import const, utils  # noqa: E402
from jhora.panchanga import drik, pancha_paksha  # noqa: E402

configure_ayanamsa(drik)


def ensure_ayanamsa() -> None:
    """Call at the top of every calculator entry point — see
    configure_ayanamsa's docstring for why the import-time call above isn't
    sufficient on its own."""
    configure_ayanamsa(drik)


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


def tara_bala_groups(jd: float, p) -> list[list[int]]:
    """9 lists of 1-based birth-star nakshatra indices (1..27), grouped by
    which tārā category today's Moon nakshatra places them in — index 0..8,
    see calculator.py's TARA_KEYS/TARA_EFFECT_ORDER for what each means."""
    return drik.thaaraabalam(jd, p, return_only_good_stars=False)


def natal_moon_rashi_1based(jd: float, p) -> int:
    return drik.raasi(jd, p)[0]


def chandrashtama_today(jd: float, p) -> tuple[int, float]:
    """(afflicted_rasi_1based, window_end_jd) — the ONE rashi currently
    8th-from-Moon (whichever natal rashi is presently in chandrashtama),
    plus the JD the Moon next changes sign (the window's end). Does not
    take a natal rashi as input — the caller compares afflicted_rasi
    against the user's own natal Moon rashi."""
    return drik.chandrashtama(jd, p)


def previous_moon_rashi_entry_jd(jd: float, p) -> float:
    """The JD the Moon most recently entered its current rashi — the start
    of the current chandrashtama window, if any (chandrashtama_today only
    gives the end)."""
    return drik.next_planet_entry_date(const._MOON, jd, p, direction=-1)[0]


def disha_shool_index(jd: float, p) -> int:
    """0-based cardinal direction index (see repository.DISHA_KEYS) that's
    classically inauspicious for travel on this date's weekday — a pure
    weekday lookup, the same vaara() this app already uses for
    schedule.weekday, so it's always consistent with the day already shown."""
    return drik.disha_shool(jd, p)


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

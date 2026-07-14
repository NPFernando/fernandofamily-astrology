"""Second jhora-importing adapter (alongside pancha_pakshi's) — same rules:
thin pass-throughs only, no enums, no business logic, and never touches
utils.set_language/resource_strings or any upstream display string. Display
names are derived from the stable 1-based integer indices these functions
return, mapped to our own keys in repository.py.

Verified return conventions (empirically, against the pinned vendored source):
element start/end times are FLOAT LOCAL HOURS relative to midnight of the
calendar date embedded in `jd` — negative means the previous calendar day,
>= 24 means a following day. trikalam() and the [1] element of the rise/set
functions return 'HH:MM:SS' display strings; callers should prefer the float
forms.
"""
from app.core.vendor_path import ensure_vendor_on_path

ensure_vendor_on_path()

from jhora.panchanga import drik  # noqa: E402


def tithi(jd: float, p) -> list:
    """[tithi_no(1..30), start_hrs, end_hrs] + optionally
    [next_no, next_start_hrs, next_end_hrs] when a second tithi falls on the day."""
    return drik.tithi(jd, p)


def nakshatra(jd: float, p) -> list:
    """[nak_no(1..27), pada(1..4), start_hrs, end_hrs] + optionally
    [next_no, next_pada, next_end_hrs] (note: no next_start)."""
    return drik.nakshatra(jd, p)


def yogam(jd: float, p) -> list:
    """[yoga_no(1..27), start_hrs, end_hrs, frac] + optionally
    [next_no, next_start_hrs, next_end_hrs, next_frac]."""
    return drik.yogam(jd, p)


def karana(jd: float, p) -> tuple:
    """(karana_no(1..60), start_hrs, end_hrs) — the karana prevailing at the
    day's sunrise only; successors must be derived from the tithi halves
    (see calculator), because this function re-anchors to sunrise internally.
    """
    return drik.karana(jd, p)


def lunar_month(jd: float, p) -> list:
    """[month_no(1..12), is_leap(bool), is_nija(bool)]."""
    return drik.lunar_month(jd, p)


def moonrise(jd: float, p) -> list:
    """[local_hrs_float, 'HH:MM:SS', jd] — may hold implausible sentinel values
    at extreme latitudes (no rise that day); callers must plausibility-check."""
    return drik.moonrise(jd, p)


def moonset(jd: float, p) -> list:
    return drik.moonset(jd, p)


def trikalam(jd: float, p, option: str) -> list:
    """['HH:MM:SS', 'HH:MM:SS'] start/end. Options: 'raahu kaalam',
    'yamagandam', 'gulikai' (upstream spellings)."""
    return drik.trikalam(jd, p, option)

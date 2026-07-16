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
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

from jhora import const  # noqa: E402
from jhora.panchanga import drik  # noqa: E402

configure_ayanamsa(drik)


def ensure_ayanamsa() -> None:
    """Call at the top of every calculator entry point — see
    configure_ayanamsa's docstring for why the import-time call above isn't
    sufficient on its own."""
    configure_ayanamsa(drik)


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


def gauri_choghadiya(jd: float, p) -> list[tuple[int, str, str]]:
    """16 (type_index 0..6, start 'HH:MM:SS', end 'HH:MM:SS') tuples in
    chronological order: 8 day segments (sunrise-to-sunset, 1/8th each) then
    8 night segments (sunset-to-next-sunrise, 1/8th each). Segment i's end
    always equals segment i+1's start. Night segments crossing midnight
    reset their HMS string to be relative to the new calendar day rather
    than continuing past 24:00:00 — callers must detect this (see
    calculator.py's cumulative-hours parsing), the same caveat trikalam()
    doesn't have since kalams never cross midnight."""
    return drik.gauri_choghadiya(jd, p)


def shubha_hora(jd: float, p) -> list[tuple[int, str, str]]:
    """24 (planet_index 0..6, start, end) tuples: 12 day + 12 night hora
    segments, same chronological/midnight-crossing shape as
    gauri_choghadiya but twelfths instead of eighths."""
    return drik.shubha_hora(jd, p)


def abhijit_muhurta(jd: float, p) -> list:
    """['HH:MM:SS', 'HH:MM:SS'] start/end — the 8th of 15 daily muhurtas
    (roughly midday), always exactly one window, well within daytime so
    never crosses midnight."""
    return drik.abhijit_muhurta(jd, p)


def durmuhurtam(jd: float, p) -> list:
    """['HH:MM:SS', 'HH:MM:SS'] or ['HH:MM:SS','HH:MM:SS','HH:MM:SS','HH:MM:SS']
    — Sunday/Wednesday/Saturday have exactly one durmuhurtam window; every
    other weekday has two. Never empty, never crosses midnight (offsets stay
    within a single day/night duration)."""
    return drik.durmuhurtam(jd, p)


def graha_longitudes(jd: float, p) -> list[tuple[int, float]]:
    """[(planet_id 0..8, sidereal_longitude_degrees), ...] for the 9 grahas
    (Sun..Ketu, see repository.GRAHA_KEYS for the order).

    Deliberately NOT calling upstream's own `planetary_positions()`: it
    crashes unconditionally (`planet_list.index(planet)`, but `planet_list`
    is a dict — dicts have no `.index()` — a genuine bug in this pinned
    vendored version, not a calling-convention issue; confirmed empirically,
    reproduces every call). This reimplements the same intent using the
    exact working primitives that function itself was trying to call
    (`sidereal_longitude()`/`ketu()`), iterating `drik.planet_list` (which
    IS usable directly as a dict) — not a rewrite of the astronomy, just a
    workaround for upstream's broken wrapper.
    """
    jd_ut = jd - p.timezone / 24.0
    positions = []
    for planet_const, planet_id in drik.planet_list.items():
        if planet_const == const._KETU:
            longitude = drik.ketu(drik.sidereal_longitude(jd_ut, const._RAHU))
        else:
            longitude = drik.sidereal_longitude(jd_ut, planet_const)
        positions.append((planet_id, longitude))
    return positions


def retrograde_planet_ids(jd: float, p) -> list[int]:
    """List of planet_id (repository.GRAHA_KEYS) currently retrograde. Sun
    and Moon never retrograde and are never in this list.

    NOTE: upstream's `planets_in_stationary()` — the natural complement —
    has its own separate bug in this pinned version: it crashes on Ketu
    under the true-node Rahu/Ketu configuration this app actually runs
    with (calls swe.calc_ut with Ketu's sentinel constant directly, which
    isn't a real body swisseph knows how to compute; confirmed
    empirically). `planets_in_retrograde()` correctly special-cases Ketu
    (checks Rahu's speed instead) and does not have this bug, which is why
    only retrograde is offered here, not stationary."""
    return drik.planets_in_retrograde(jd, p)

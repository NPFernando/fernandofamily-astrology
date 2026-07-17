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

import swisseph as swe  # noqa: E402
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


def raasi(jd: float, p) -> list:
    """Moon rashi at the given moment.

    Returns [rashi_no(1..12), end_hrs, frac_left] and may include a skipped
    rashi successor. The end time follows the same float-local-hours convention
    as tithi/nakshatra.
    """
    return drik.raasi(jd, p)


def previous_moon_rashi_entry_jd(jd: float, p) -> float:
    return drik.next_planet_entry_date(const._MOON, jd, p, direction=-1)[0]


def ritu(maasa_index: int) -> int:
    """0..5 season index derived from lunar month index."""
    return drik.ritu(maasa_index)


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


def next_solar_eclipse_raw(jd_ut: float, p) -> tuple[int, tuple, tuple]:
    """Passthrough of drik.next_solar_eclipse (itself a thin wrapper over
    swe.sol_eclipse_when_loc — the search is already location-aware: it
    finds the next eclipse with SOME contact visible from `p`, not merely
    the next eclipse anywhere on Earth). Unlike every other jd this adapter
    handles, `jd_ut` here must be a GENUINE Julian Day UT, not this app's
    local-embedded convention (see graha_longitudes' docstring for that
    distinction) — swisseph's eclipse search works in true UT throughout.

    Returns (retflag, tret, attrs):
      tret[0] = time of greatest eclipse; tret[1]/tret[4] = first/fourth
      contact (all Julian Day UT — see calculator._jd_ut_to_datetime).
      attrs[2] = obscuration (fraction of solar disc covered by the Moon);
      attrs[8] = magnitude (NASA convention).
      retflag bit-decodes via solar_eclipse_type()/eclipse_is_visible()/
      solar_contact_visible() below — do not inspect tret[1]/tret[4] for
      zero-ness to decide visibility, that heuristic is WRONG for solar:
      empirically, swisseph still returns a nonzero geometric contact time
      even when that contact isn't actually visible from `p` (e.g. it
      happens after local sunset) — the ECL_1ST_VISIBLE/ECL_4TH_VISIBLE
      bits are the only correct signal, confirmed by direct reproduction.
    """
    return drik.next_solar_eclipse(jd_ut, p)


def next_lunar_eclipse_raw(jd_ut: float, p) -> tuple[int, tuple, tuple]:
    """Passthrough of drik.next_lunar_eclipse (wraps swe.lun_eclipse_when_loc
    directly). Same genuine-Julian-Day-UT input convention as
    next_solar_eclipse_raw above.

    NOTE: the vendored drik.next_lunar_eclipse docstring copies the solar
    one almost verbatim and is WRONG about tret's indices for lunar — the
    true pyswisseph semantics (confirmed directly against
    swe.lun_eclipse_when_loc's own docstring and empirical reproduction)
    are: tret[0] = time of max eclipse; tret[2]/tret[3] = partial phase
    begin/end; tret[4]/tret[5] = totality begin/end; tret[6]/tret[7] =
    overall (penumbral) event begin/end. All Julian Day UT.
    attrs[0] = umbral magnitude, attrs[1] = penumbral magnitude.

    Unlike solar, a zero-value IS the correct "not applicable/not visible
    from here" sentinel for these slots — confirmed empirically both for
    phases that don't occur at all for this eclipse's type (e.g. tret[4]/
    tret[5] are 0.0 for a penumbral-only eclipse, which has no totality)
    and for phases that occur but aren't visible from `p` (e.g. tret[2]
    was 0.0 for a real partial eclipse where the partial phase began
    below the horizon at `p`, while tret[3] — the end, which WAS visible
    there — was correctly nonzero). This is the opposite of solar's
    behavior above; pyswisseph's own docs don't document a lunar
    per-contact visibility-bit mapping, so the zero-sentinel is the only
    grounded signal available, and it was verified to behave correctly
    across several real eclipses before relying on it.
    """
    return drik.next_lunar_eclipse(jd_ut, p)


def solar_eclipse_type(retflag: int) -> str:
    """'hybrid' | 'total' | 'annular' | 'partial'. Hybrid checked first:
    swe.ECL_ANNULAR_TOTAL and swe.ECL_HYBRID are the same bit value (32)."""
    if retflag & swe.ECL_ANNULAR_TOTAL:
        return "hybrid"
    if retflag & swe.ECL_TOTAL:
        return "total"
    if retflag & swe.ECL_ANNULAR:
        return "annular"
    return "partial"


def lunar_eclipse_type(retflag: int) -> str:
    """'total' | 'partial' | 'penumbral' — mutually exclusive in practice
    (confirmed empirically: never more than one of these three bits set)."""
    if retflag & swe.ECL_TOTAL:
        return "total"
    if retflag & swe.ECL_PARTIAL:
        return "partial"
    return "penumbral"


def eclipse_is_visible(retflag: int) -> bool:
    """Whether any part of the eclipse is visible from the queried place at
    all. In practice this is essentially always True for next_*_eclipse_raw
    results, since the underlying _when_loc search already selects for
    location-visible eclipses — exposed anyway rather than assumed."""
    return bool(retflag & swe.ECL_VISIBLE)


def solar_contact_visible(retflag: int, contact: str) -> bool:
    """contact in {'first', 'fourth'} — whether that specific contact is
    observable from the queried place (see next_solar_eclipse_raw's
    docstring for why this bit, not a zero-check on tret, is authoritative)."""
    bit = {"first": swe.ECL_1ST_VISIBLE, "fourth": swe.ECL_4TH_VISIBLE}[contact]
    return bool(retflag & bit)


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

"""Empirical ayanamsa validation against the Sri Lankan New Year moment.

Neither of this app's prior claims about which ayanamsa the engine runs was
actually true: vendored jhora/const.py states a default of TRUE_PUSHYA, but
that default is only ever applied inside drik.py's `if __name__ == "__main__"`
guard — dead code from this app's point of view. This app's own docs claimed
"a Lahiri-family ayanamsa". Neither call ever actually ran; swisseph silently
fell back to its compiled-in default (Fagan-Bradley) on every request.

The Sinhala/Tamil New Year (Aluth Avurudu) dawns at the exact moment the Sun's
sidereal longitude crosses 0 degrees (Mesha Sankranti, the Pisces-to-Aries
ingress) — a single, government-published instant that hundreds of thousands
of Sri Lankans set their New Year rituals by. Crucially, the Sun's disk takes
~12h48m to fully cross that boundary (leading edge to trailing edge, per
Wikipedia's "Sinhalese New Year" article), and the officially published
"Nonagathaya"/"Punya Kaalaya" neutral period brackets exactly that crossing:
its start is the leading-edge touch, its end is the trailing-edge clear, and
its midpoint is the point-Sun center-of-disk crossing — which is exactly what
swisseph computes and exactly what's published, separately, as the "New Year
dawns at ..." instant. That midpoint match (confirmed independently against
the officially reported dawn time in all three years below) is what makes
this a clean, ayanamsa-sensitive, single-instant ground truth, unlike the
Poya/tithi validation (tests/fixtures/sl_poya_2021_2026.json), which is
ayanamsa-INVARIANT (tithi is a Moon-minus-Sun difference; the ayanamsa offset
cancels out) and so cannot discriminate between candidate ayanamsa modes.

Ground truth (Punya Kaalaya start/end, Sri Lanka time UTC+5:30), each cross-
checked against at least one independent news source reporting the same
"dawns at" instant as this window's midpoint:
  2024: 2024-04-13 14:41 -- 2024-04-14 03:29  (midpoint 21:05, matches
        Ada Derana's "dawns at 9:05 p.m. on April 13")
  2025: 2025-04-13 20:57 -- 2025-04-14 09:45  (midpoint 03:21, matches
        News21's "dawns at 3:21 AM" and gazette.lk's republication)
  2026: 2026-04-14 03:08 -- 2026-04-14 15:56  (midpoint 09:32, matches
        multiple outlets' "dawns at 9:32 a.m.")

Run:  cd apps/api && .venv/bin/python scripts/dev/ayanamsa_newyear_check.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.core.vendor_path import ensure_vendor_on_path  # noqa: E402

ensure_vendor_on_path()

import swisseph as swe  # noqa: E402

CANDIDATE_MODES = {
    "FAGAN": swe.SIDM_FAGAN_BRADLEY,
    "LAHIRI": swe.SIDM_LAHIRI,
    "TRUE_CITRA": swe.SIDM_TRUE_CITRA,  # the vendored const.py's "TRUE_LAHIRI" entry actually points here
    "TRUE_PUSHYA": swe.SIDM_TRUE_PUSHYA,  # upstream's stated (but never-applied) default
    "TRUE_MULA": swe.SIDM_TRUE_MULA,
    "KP": swe.SIDM_KRISHNAMURTI,
    "RAMAN": swe.SIDM_RAMAN,
}

COLOMBO_OFFSET = timedelta(hours=5, minutes=30)
COLOMBO_TZ = timezone(COLOMBO_OFFSET)

# Punya Kaalaya (start, end) in Sri Lanka local time; published "dawns at"
# instant is each window's midpoint (see module docstring for sourcing).
GROUND_TRUTH = {
    2024: (datetime(2024, 4, 13, 14, 41, tzinfo=COLOMBO_TZ), datetime(2024, 4, 14, 3, 29, tzinfo=COLOMBO_TZ)),
    2025: (datetime(2025, 4, 13, 20, 57, tzinfo=COLOMBO_TZ), datetime(2025, 4, 14, 9, 45, tzinfo=COLOMBO_TZ)),
    2026: (datetime(2026, 4, 14, 3, 8, tzinfo=COLOMBO_TZ), datetime(2026, 4, 14, 15, 56, tzinfo=COLOMBO_TZ)),
}


def _to_jd_ut(dt: datetime) -> float:
    dt_utc = dt.astimezone(timezone.utc)
    hour = dt_utc.hour + dt_utc.minute / 60 + dt_utc.second / 3600
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour)


def _from_jd_ut(jd_ut: float) -> datetime:
    y, m, d, hour = swe.revjul(jd_ut, swe.GREG_CAL)
    base = datetime(y, m, d, tzinfo=timezone.utc) + timedelta(hours=hour)
    return base.astimezone(COLOMBO_TZ)


def _sidereal_sun_longitude(jd_ut: float, mode_const: int) -> float:
    swe.set_sid_mode(mode_const, 0, 0)
    lon, _ = swe.calc_ut(jd_ut, swe.SUN, swe.FLG_SWIEPH | swe.FLG_SIDEREAL)
    return lon[0]


def _find_aries_ingress(year: int, mode_const: int) -> datetime:
    """Bisect for the instant the Sun's sidereal longitude crosses 0 degrees,
    within a window a few days either side of the New Year's usual mid-April
    date."""
    lo = _to_jd_ut(datetime(year, 4, 10, tzinfo=COLOMBO_TZ))
    hi = _to_jd_ut(datetime(year, 4, 18, tzinfo=COLOMBO_TZ))

    def offset(jd: float) -> float:
        lon = _sidereal_sun_longitude(jd, mode_const)
        return lon - 360 if lon > 180 else lon

    if offset(lo) > 0 or offset(hi) < 0:
        raise AssertionError(f"no Aries ingress found for {year} in search window")
    for _ in range(60):
        mid = (lo + hi) / 2
        if offset(mid) < 0:
            lo = mid
        else:
            hi = mid
    return _from_jd_ut((lo + hi) / 2)


def main() -> None:
    print(f"{'mode':<12}" + "".join(f"{year:>22}" for year in GROUND_TRUTH))
    for name, mode_const in CANDIDATE_MODES.items():
        row = f"{name:<12}"
        for year, (start, end) in GROUND_TRUTH.items():
            published = start + (end - start) / 2
            computed = _find_aries_ingress(year, mode_const)
            delta_minutes = (computed - published).total_seconds() / 60
            row += f"{delta_minutes:>+21.1f}m"
        print(row)
    print("\n(each cell: computed ingress minus published dawn instant, in minutes)")


if __name__ == "__main__":
    main()

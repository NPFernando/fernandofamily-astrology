"""Empirical Poya-rule discovery against the official gazette fixture.

The Sri Lankan Poya day is "the full moon day" — but which *civil date* that
means has several defensible readings. This script scores each candidate rule
against every gazetted Poya day 2021-2026 (tests/fixtures/sl_poya_2021_2026.json,
extracted from the MIT-licensed Dilshan-H/srilanka-holidays dataset) so the
production rule is the one that demonstrably reproduces the gazette, not the
one that merely sounds right.

Candidate rules for "date D is the Poya day":
  a) D contains the instant purnima (tithi 15) ENDS — i.e. the astronomical
     full-moon opposition moment (tithi 15's end IS the 180-degree instant,
     so the plan's rules (a) and (c-instant) coincide by construction).
  b) purnima is the tithi prevailing at D's SUNRISE.
  c) D contains the instant purnima STARTS (elongation reaches 168 degrees).
  d) like (a), but an end falling before D's sunrise assigns the PREVIOUS
     civil day (sunrise-bounded variant of the end rule).
  e) the civil day of the FIRST SUNSET AFTER purnima starts — equivalently,
     the start day, bumped one day when purnima begins after that day's
     sunset. (Derived from rule c's mismatch pattern: every gazette
     divergence from the start-day rule had an evening start.)
  f) rule e with a 15-minute pre-sunset buffer: the start day counts only
     when purnima begins at least 15 minutes BEFORE that day's sunset.
     Rationale: the two rule-e misses had purnima starting 2.3 and 5.9
     minutes before OUR computed sunset — inside the minutes-level
     disagreement between litha panels' calculations and Lahiri+swisseph;
     the margins of all agreeing cases sit >= 23.3 minutes away, so any
     threshold in (5.9, 23.3) reproduces the gazette 73/73. 15 is chosen
     as a round midpoint.

Run:  cd apps/api && .venv/bin/python scripts/dev/poya_rule_discovery.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.modules.pancha_pakshi import adapter as pp_adapter  # noqa: E402
from app.modules.panchanga import adapter  # noqa: E402

COLOMBO = ("Colombo", 6.9271, 79.8612, 5.5)
FIXTURE = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "sl_poya_2021_2026.json"


def _dt(base: date, hours: float) -> datetime:
    tz = timezone(timedelta(hours=COLOMBO[3]))
    return datetime(base.year, base.month, base.day, tzinfo=tz) + timedelta(seconds=round(hours * 3600))


def tithi_spans(day: date) -> list[tuple[int, datetime, datetime]]:
    place = pp_adapter.place(*COLOMBO)
    noon_jd = pp_adapter.julian_day_number(pp_adapter.date(day.year, day.month, day.day), (12, 0, 0))
    raw = adapter.tithi(noon_jd, place)
    spans = [(int(raw[0]), _dt(day, raw[1]), _dt(day, raw[2]))]
    if len(raw) >= 6:
        spans.append((int(raw[3]), _dt(day, raw[4]), _dt(day, raw[5])))
    return spans


def sunset_at(day: date) -> datetime:
    place = pp_adapter.place(*COLOMBO)
    noon_jd = pp_adapter.julian_day_number(pp_adapter.date(day.year, day.month, day.day), (12, 0, 0))
    return _dt(day, pp_adapter.sunset(noon_jd, place)[0])


def sunrise_at(day: date) -> datetime:
    place = pp_adapter.place(*COLOMBO)
    noon_jd = pp_adapter.julian_day_number(pp_adapter.date(day.year, day.month, day.day), (12, 0, 0))
    return _dt(day, pp_adapter.sunrise(noon_jd, place)[0])


def purnima_window(around: date) -> tuple[datetime, datetime]:
    """The start/end instants of the purnima nearest `around` (scan +/-3 days)."""
    seen: dict[str, tuple[datetime, datetime]] = {}
    for off in range(-3, 4):
        day = around + timedelta(days=off)
        for idx, start, end in tithi_spans(day):
            if idx == 15:
                seen[start.isoformat()] = (start, end)
    if not seen:
        raise RuntimeError(f"no purnima found near {around}")
    best = min(seen.values(), key=lambda w: abs((w[1].date() - around).days))
    return best


def main() -> None:
    fixture = json.loads(FIXTURE.read_text())
    scores: Counter[str] = Counter()
    mismatches: dict[str, list[str]] = {"a": [], "b": [], "c": [], "d": [], "e": [], "f": []}

    for entry in fixture:
        gazette = date.fromisoformat(entry["date"])
        start, end = purnima_window(gazette)

        pred: dict[str, date | None] = {}
        pred["a"] = end.date()
        pred["c"] = start.date()
        pred["d"] = end.date() if end >= sunrise_at(end.date()) else end.date() - timedelta(days=1)
        # b: which day's sunrise falls inside [start, end)?
        pred["b"] = None
        for off in range(-2, 3):
            day = gazette + timedelta(days=off)
            if start <= sunrise_at(day) < end:
                pred["b"] = day
                break
        start_day_sunset = sunset_at(start.date())
        pred["e"] = start.date() if start <= start_day_sunset else start.date() + timedelta(days=1)
        pred["f"] = (
            start.date()
            if start <= start_day_sunset - timedelta(minutes=15)
            else start.date() + timedelta(days=1)
        )

        for rule in ("a", "b", "c", "d", "e", "f"):
            if pred[rule] == gazette:
                scores[rule] += 1
            else:
                mismatches[rule].append(
                    f"  {entry['name']} gazette={gazette} predicted={pred[rule]} "
                    f"(purnima {start:%Y-%m-%d %H:%M} -> {end:%Y-%m-%d %H:%M})"
                )

    total = len(fixture)
    print(f"Gazette Poya days scored: {total}\n")
    print("rule  description                                   score")
    labels = {
        "a": "civil date containing purnima END (full moon)",
        "b": "purnima prevailing at sunrise",
        "c": "civil date containing purnima START",
        "d": "purnima END, pre-sunrise endings -> previous day",
        "e": "first sunset after purnima start",
        "f": "rule e with 15-minute pre-sunset buffer",
    }
    for rule in ("a", "b", "c", "d", "e", "f"):
        print(f"  {rule}   {labels[rule]:<46} {scores[rule]}/{total} ({scores[rule] / total:.1%})")
    for rule in ("a", "b", "c", "d", "e", "f"):
        if mismatches[rule]:
            print(f"\nrule {rule} mismatches ({len(mismatches[rule])}):")
            print("\n".join(mismatches[rule]))

    month_naming_check(fixture)


def month_naming_check(fixture: list[dict]) -> None:
    """Every gazette Poya name must equal the Sinhala month key computed from
    the engine's amanta month at that date (adhi- prefix from the leap flag).
    """
    from app.modules.panchanga.repository import sinhala_month_key

    ok = 0
    fails = []
    for entry in fixture:
        g = date.fromisoformat(entry["date"])
        place = pp_adapter.place(*COLOMBO)
        noon_jd = pp_adapter.julian_day_number(pp_adapter.date(g.year, g.month, g.day), (12, 0, 0))
        m = adapter.lunar_month(noon_jd, place)
        key = sinhala_month_key(int(m[0]), bool(m[1]))
        expected = entry["name"].replace(" Full Moon Poya Day", "").lower().replace(" ", "-")
        if key == expected:
            ok += 1
        else:
            fails.append(f"  {g} gazette='{expected}' computed='{key}' raw={m}")
    print(f"\nSinhala month naming vs gazette: {ok}/{len(fixture)}")
    if fails:
        print("\n".join(fails))


if __name__ == "__main__":
    main()

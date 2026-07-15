# Daily Panchanga

## Elements

`POST /api/v1/panchanga/daily` returns the five traditional panchanga
elements (tithi, nakshatra, yoga, karana, vaara/weekday) for a location and
date, plus the three inauspicious kalams (rahu, yamaganda, gulika) and
sun/moon rise-set times. Every element is computed directly from the
vendored, pinned engine (see [`birth-bird.md`](birth-bird.md) for the
general adapter/calculator layering this module reuses) — none of it is
looked up from a static table.

Elements that change more than once within a single calendar day (tithi,
nakshatra, yoga can each end and hand off to the next element before the
following sunrise) return every entry that overlaps the day, each with its
own end time, rather than only the value in effect at sunrise.

## Ayanamsa

Sidereal longitudes — which every element above ultimately derives from —
depend on the ayanamsa (the offset between the tropical and sidereal
zodiacs). This module uses the vendored engine's own default (a
Lahiri-family ayanamsa), the same one Pancha Pakshi's schedule calculations
already rely on, and does not override it. Different published Sri Lankan
litha can use slightly different ayanamsa conventions; where they diverge
from Lahiri, an element's end time can differ by a few minutes from what a
particular printed almanac shows. This is a genuine cross-tradition
difference, not a bug in either source.

## Sri Lankan layer: Poya days and Sinhala months

In addition to the pan-Vedic elements above, the response includes:

- `sinhala_month` — the Poya-cycle month name (bak, vesak, poson, esala,
  nikini, binara, vap, il, unduvap, duruthu, nawam, madin; an `adhi-` prefix
  marks a leap/intercalary month), which is what a Sri Lankan reader expects
  to see rather than the Sanskrit amanta month name (`lunar_month`, still
  returned alongside it). The Sinhala month for a date is the month named
  for that date's *next* Poya.
- `is_poya_day` / `poya` — whether the date is a full-moon Poya day, and if
  so, which one.
- `next_poya` — the date and month of the next (or, on a Poya day itself,
  that same) Poya.

**Poya-day rule.** A civil date is a Poya day when a purnima (full-moon
tithi) begins on that date at least 15 minutes before that date's sunset;
otherwise the Poya falls on the following date. This rule, and the Sinhala
month naming built on it, were derived empirically — not assumed — by
computing every candidate rule against all 73 officially gazetted Sri
Lankan Poya days from 2021 through 2026 (source: the
[Dilshan-H/srilanka-holidays](https://github.com/Dilshan-H/srilanka-holidays)
dataset, MIT-licensed, committed as a verification fixture at
`apps/api/tests/fixtures/sl_poya_2021_2026.json`; the comparison script is
`apps/api/scripts/dev/poya_rule_discovery.py`). The chosen rule reproduces
**100% (73/73)** of the gazetted dates, including 2026's intercalary
"Adhi Esala" Poya.

**Known divergence.** Sinhala month naming matches the gazette for 72 of
those 73 dates. The one exception is 2026-05-30: the gazette names it
"Vesak Full Moon Poya Day", while this engine's Lahiri-based placement of
that year's intercalary month computes it as "Adhi Poson". This is a
genuine difference in adhika-month placement convention between this
engine and that year's gazette panel, not a computation error — it is
encoded as a named, tested exception in `apps/api/tests/test_poya.py`
rather than silently forced to match.

**Coverage range.** Poya and Sinhala-month computation share the same
ephemeris-driven date range as the rest of the engine — see the image's
trimmed range in [`../../apps/api/vendor/README.md`](../../apps/api/vendor/README.md).

**Not implemented.** Avurudu nekath (the Sinhala/Tamil New Year's
astrologer-panel auspicious times) are published annually as PDFs by a
government-convened panel and are not derivable by calculation — there is
no structured dataset to compute or validate against. Adding them would
require transcribing each year's published schedule by hand; see
[`../roadmap.md`](../roadmap.md).

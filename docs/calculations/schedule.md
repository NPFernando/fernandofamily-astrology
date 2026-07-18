# Schedule calculation

## The Pancha Pakshi day is sunrise-to-sunrise, not midnight-to-midnight

Every schedule covers local sunrise → the *next* local sunrise, not
00:00–24:00. If the requested target time is before that day's sunrise, the
calculation rolls back to the previous sunrise-based day first — mirroring
the pinned engine's own reference behavior exactly:

```
jd = julian_day_number(date, time)
sunrise_jd = sunrise(jd, place)
if jd < sunrise_jd:
    jd -= 1
    sunrise_jd = sunrise(jd, place)
```

The effective weekday, Paksha, and Nakshatra are all resolved *after* this
rollback, from the rolled-back `jd` — not from the originally requested
calendar date. The weekday in particular comes from the underlying engine's
own sunrise-based ("vedic day") weekday function, which already implements
this convention internally; the app does not separately re-derive weekday
from midnight boundaries.

## Ten major periods, fifty sub-periods

- Daytime (sunrise → sunset) is divided into 5 equal major periods; nighttime
  (sunset → next sunrise) into another 5 equal major periods — 10 total.
  This equal division is the pinned engine's actual behavior; a differently
  weighted division (48:30:36:18:12) appears as an unused constant in the
  reference source but is not what the reference calculation function
  actually applies, so this app follows the real behavior rather than that
  unused constant.
- Each major period is further divided into 5 sub-periods, using duration
  weights that come from the pinned lookup table and sum to the major
  period's full duration — 50 sub-periods total.
- Boundaries are start-inclusive, end-exclusive (`starts_at <= t < ends_at`),
  and the very first sub-period starts exactly at sunrise while the very
  last ends exactly at the next sunrise, with no gaps or overlaps anywhere
  in between. Any floating-point rounding remainder is absorbed into the
  final sub-period so the sequence lands exactly on the expected boundary.

Every schedule response is validated against these invariants before being
returned — a computation that would otherwise violate any of them (wrong
period count, a gap, an overlap, a period that doesn't start where the
previous one ended) raises an internal error instead of silently returning
malformed data.

## Every field originates from the pinned data, not from independent rules

Main activity, sub-bird, sub-activity, relation, duration weighting, power
factor, traditional effect, rating, Padu Pakshi, and Bharana Pakshi all come
directly from the pinned `pancha_pakshi_db.csv` lookup table — this app maps
its integer-coded columns onto stable internal enums (see
`apps/api/app/modules/pancha_pakshi/enums.py` and `repository.py`) but never
invents or independently derives any of these values.

## Activity guidance is explanatory copy, not a calculation field

The UI also shows short "traditional guidance" text for the five activities
and effect levels. That text is bilingual explanatory copy, summarized from
public descriptions of Pancha Pakshi's five states and common favourable /
unfavourable timing language; it does not alter the computed schedule,
effect, or rating. Useful references for the traditional activity framing:

- OnlineJyotish, Pancha Pakshi forecast:
  <https://www.onlinejyotish.com/free-astrology/pancha-pakshi-forecast.php>
- Drik Panchang, Pancha Pakshi bird calculator:
  <https://www.drikpanchang.com/pancha-pakshi/bird/pancha-pakshi-bird-calculator.html>
- Pancha Pakshi Shastra overview:
  <https://en.wikipedia.org/wiki/Pancha_Pakshi_Shastra>

These sources are all pan-Indian/general Vedic astrology references, not
Sri Lanka-specific. A later research round (see `docs/jyotishya-ideas.md`
section A0) specifically checked whether Pancha Pakshi is genuine, active
Sinhala practice rather than a borrowed system with no local uptake, and
found independent Sri Lankan evidence: a dedicated Sinhala-language book,
*Panchapakshi Shasthraya ha Yamakalaya* by O.A. Perera (sold through
M.D. Gunasena, Sri Lanka's oldest publisher/bookseller), and Sinhala
astrology sites (e.g. kaladasava.com) presenting it as ordinary local
practice rather than a foreign import.

## Current and next period

Given a schedule and a point in time, the current sub-period is the one
whose interval contains that time under the start-inclusive/end-exclusive
rule above; the next sub-period is simply the following one in sequence
(crossing major-period boundaries where needed). A live client-facing
countdown is computed from the server-reported current period's end time,
corrected for the client/server clock offset measured at load time — the
countdown display is a client-side convenience, not an independent
recalculation of the schedule.

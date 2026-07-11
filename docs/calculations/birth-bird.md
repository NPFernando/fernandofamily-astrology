# Birth-bird calculation

## Three input methods

**Method A — birth details.** Birth date, time, place (lat/lon/IANA
timezone). The engine computes the birth Nakshatra and Paksha (waxing/waning)
for that exact moment, then looks up the corresponding bird.

**Method B — known Nakshatra + Paksha.** If birth time or location isn't
known precisely enough to compute Method A reliably, the Nakshatra (1–27)
and Paksha can be supplied directly.

**Method C — direct bird selection.** Skip birth-bird derivation entirely
and pick one of the five birds directly. This is the only method that
doesn't require any birth information at all.

The app deliberately does not attempt to *guess* a birth Nakshatra or Paksha
when birth time/location are unknown — it points the user at Methods B or C
instead.

## The mapping table

27 Nakshatras map to one of five birds, with the bird differing by Paksha:

| Nakshatras | Waxing (Shukla Paksha) | Waning (Krishna Paksha) |
|---|---|---|
| 1–5 (Ashwini–Mrigashirsha) | Vulture | Peacock |
| 6–11 (Ardra–Uttara Phalguni) | Owl | Cock |
| 12–16 (Hasta–Vishakha) | Crow | Crow |
| 17–21 (Anuradha–Uttara Ashadha) | Cock | Owl |
| 22–27 (Shravana–Revati) | Peacock | Vulture |

This table is transcribed verbatim from the pinned PyJHora release's own
`pancha_pakshi_stars_birds_paksha` table (commit `ca22995`, release
`V4.8.7`) and independently verified entry-by-entry against it — it is not
an independent derivation from general Pancha Pakshi literature.

## Padu Pakshi and Bharana Pakshi

Every computed schedule also reports a Padu Pakshi ("resting/base bird") and
Bharana Pakshi ("supporting bird") for the birth bird, weekday, and Paksha in
question. These come directly from the pinned lookup table
(`pancha_pakshi_db.csv`'s `padu_pakshi`/`bharana_pakshi` columns), not from
any independent rule.

**Important**: Padu Pakshi is constant for a given (bird, weekday, paksha)
combination, but Bharana Pakshi is **not** — it differs between day and
night major periods. The API reflects this correctly: every `MajorPeriod`
in a schedule response carries its own `padu_pakshi`/`bharana_pakshi`
fields, which are authoritative. The schedule-level `padu_pakshi`/
`bharana_pakshi` fields are a convenience mirror of the first major
period's values only — callers that need the correct value for a specific
part of the day/night should read it from that period, not the top-level
field.

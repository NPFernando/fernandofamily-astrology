# Roadmap

## Shipped / in progress

- Platform landing page
- Pancha Pakshi live calculator (birth-bird calculation, live sunrise-to-next-sunrise
  timetable, current/next period tracking)
- Methodology, sources, privacy, disclaimer, about, and source-code pages

## Not implemented (future, unimplemented)

The following are possible future modules for this platform. **None of these
are implemented.** They must not appear in production navigation, the
sitemap, or anywhere that implies they are available, until they are
actually built, registered in the feature registry (`packages/feature-registry`),
and explicitly enabled.

- Daily Panchanga
- Birth Nakshatra calculator
- Birth chart / Kundali
- Muhurta tools
- Moon phase and Tithi
- Horoscope compatibility
- Planetary positions
- Festival calendar
- Dasha calculations
- Sinhala astrology reference material

Adding any of these later should follow the same modular pattern as Pancha
Pakshi: an isolated `apps/api/app/modules/<feature>/` backend module, its own
feature-registry entry, and no changes required to existing modules or the
platform shell.

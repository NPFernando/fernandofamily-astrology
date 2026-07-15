# Roadmap

## Shipped

- Platform landing page (dawn-gradient hero, feature registry driven)
- Pancha Pakshi live calculator — all three input methods (birth details,
  known Nakshatra + Paksha, direct bird), live sunrise-to-next-sunrise
  timetable (timeline / table / week views), current-period tracking with
  clock-skew-corrected countdown, proportional day-overview bar
- Zero-click first result (auto-computes with defaults/last-used on landing),
  date navigation, "Best times today" card, activity/effect legend, sticky
  current-period bar
- Sourced activity guidance for current periods, best windows, and legend
  context, with bilingual culturally-scoped copy and disclaimer
- Ambient full-screen Pancha Pakshi live view (`/pancha-pakshi/live`) for
  wall-tablet display: large countdown, current/next period, guidance,
  auto-refresh, and session-only derived-bird handoff from the calculator
- Auspicious-windows API (`POST /api/v1/pancha-pakshi/windows`) — favourable
  windows over a 1–14 day span, powering the week view
- Saved profiles: device-local for everyone; synced server-side when signed
  in (invite-only Google sign-in scaffold, feature-flagged off until OAuth
  credentials are configured)
- Bilingual UI (English / Sinhala) with per-page SEO metadata, OG share
  image, JSON-LD; PWA with offline-labeled cached schedules
- Methodology, sources, privacy, disclaimer, about, licensing pages
- Engine: vendored, checksummed PyJHora V4.8.7 with golden-test parity;
  Docker image ships a trimmed 1800–2399 ephemeris subset while the repo
  retains the full 5,400-year dataset (see
  [`../apps/api/vendor/FUTURE_DATA_USES.md`](../apps/api/vendor/FUTURE_DATA_USES.md))

- Auspicious-windows deepening: activity + minimum-duration filters on the
  windows API and week view; month heat-map of favourable-time density
  (`POST /api/v1/pancha-pakshi/summary`)
- Opt-in web-push alerts before favourable periods (subscriptions live in the
  astrology database — bird/nakshatra identity, ~1km-rounded location,
  preferences only; dispatched by a host cron via a loopback-only endpoint)
- Calendar export: favourable windows download as RFC 5545 `.ics` files,
  generated fully client-side (single window or all currently shown)

- Export: polished print layout (full or major-periods-only) and
  server-rendered per-schedule PNG share cards (same detail option), plus the
  earlier `.ics` calendar export

- Daily Panchanga module — tithi, nakshatra, yoga, karana, lunar month,
  weekday and the day's inauspicious kalams (rahu / yamaganda / gulika) with
  sun and moon times, for any location and date, bilingual, zero-click on
  load (`/panchanga`, `POST /api/v1/panchanga/daily`)
- Bird Compatibility mini-tool — direct two-bird friend/same/enemy
  comparison using the pinned Pancha Pakshi source tables, bilingual and
  zero-click on load (`/compatibility`, `POST /api/v1/compatibility/birds`)

- Sri Lankan layer for the Daily Panchanga: Poya (full-moon) day detection
  and Sinhala Poya-cycle month names (bak, vesak, poson, … madin, with
  `adhi-` leap variants), shown primary alongside the Sanskrit amanta month.
  The Poya-day rule and Sinhala month naming were derived empirically and
  validated at 100% (73/73) against every officially gazetted Sri Lankan
  Poya day from 2021–2026 (one documented tradition/convention divergence
  in the Sinhala month name for 2026-05-30 — see
  [`../docs/calculations/panchanga.md`](../docs/calculations/panchanga.md)).
  Avurudu nekath (Sinhala/Tamil New Year auspicious times) are **not**
  implemented — they're published annually as astrologer-panel PDFs with no
  structured dataset to compute or validate against; adding them would mean
  manually transcribing each year's schedule, which isn't done here.

## Backlog (priority order)

**None of these are implemented.** They must not appear in production
navigation, the sitemap, or anywhere that implies they are available, until
they are actually built, registered in the feature registry
(`packages/feature-registry`), and explicitly enabled.

1. Telegram bot — "what's my current period?", daily morning summary.

**Explicitly out of scope** (not deferrals — decided against):
- A third (Tamil) locale. The platform stays bilingual, Sinhala + English only.
- Public API keys / third-party developer access. This platform's API is for
  its own frontend only; it is not being opened up for external integrations.

**Larger future modules** (same registry pattern; unscheduled): Muhurta
finder, birth chart / Kundali basics (asteroid + fixed-star data for these is
retained in the repo — see `FUTURE_DATA_USES.md`), Moon phase + Tithi
calendar, festival calendar, Dasha calculations, standalone birth-Nakshatra
tool, historical/ancestor chart tools (the BCE–medieval ephemeris the image
trims away remains available for exactly this).

Adding any module should follow the Pancha Pakshi pattern: an isolated
`apps/api/app/modules/<feature>/` backend module, its own feature-registry
entry, palette from `packages/design-system`, and no changes required to
existing modules or the platform shell.

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
- Compatibility tools — direct two-bird friend/same/enemy comparison using
  the pinned Pancha Pakshi source tables, plus a Vivaha Chakra wedding-date
  screener for a candidate ceremony start date/time/place using the vendored
  date rule, bilingual and zero-click on load (`/compatibility`,
  `POST /api/v1/compatibility/birds`,
  `POST /api/v1/compatibility/vivaha-chakra`)
- Sinhala Daily Astrology Guide — a Sri Lanka-focused day view combining
  Daily Panchanga, Poya status, avoid times (rahu / yamaganda / gulika),
  durmuhurtam, sun/moon times, Disha Shool, Tara Bala for known
  Nakshatra/Paksha identities, Chandrashtama when a full birth-derived Moon
  sign is available, Amrit/Abhijit/Choghadiya/Hora timing layers, current
  Pancha Pakshi period and favourable windows (`/daily-guide`). This composes
  the existing Panchanga and Pancha Pakshi APIs rather than adding a separate
  calculation engine.
- Birth Nakshatra helper — exact birth timestamp/location to Nakshatra,
  Pada, Paksha, Moon sign and derived Pancha Pakshi birth bird, with quick
  handoff into Pancha Pakshi or the Daily Guide using only derived data;
  saved profiles keep the derived Moon sign so Daily Guide Chandrashtama can
  work without storing raw birth details (`/birth-nakshatra`,
  `POST /api/v1/birth-nakshatra/resolve`).
- Muhurta-style favourable time finder — Sri Lanka-focused practical start
  windows for general work, travel, study/work, purchases and home rituals,
  combining Pancha Pakshi strength with Panchanga avoid/support periods
  (`/muhurta`, `POST /api/v1/muhurta/search`), with source-overlap details
  showing which supportive layers contributed to each recommendation.
- Moon phase + Tithi calendar — month view focused on Sri Lankan Poya days,
  tithi changes, tithi-derived moon phases and Sinhala Poya-cycle month
  context (`/moon-calendar`, `POST /api/v1/panchanga/month`).

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

1. No near-term small modules currently selected.

**Explicitly out of scope** (not deferrals — decided against):
- Telegram bot or other chat integrations.
- A third (Tamil) locale. The platform stays bilingual, Sinhala + English only.
- Public API keys / third-party developer access. This platform's API is for
  its own frontend only; it is not being opened up for external integrations.

**Larger future modules** (same registry pattern; unscheduled): birth chart /
Kundali basics (asteroid + fixed-star data for these is retained in the repo
— see `FUTURE_DATA_USES.md`), festival calendar, Dasha calculations, and
historical/ancestor chart tools (the BCE–medieval ephemeris the image trims
away remains available for exactly this).

Adding any module should follow the Pancha Pakshi pattern: an isolated
`apps/api/app/modules/<feature>/` backend module, its own feature-registry
entry, palette from `packages/design-system`, and no changes required to
existing modules or the platform shell.

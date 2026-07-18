# Roadmap

## Shipped

- Platform landing page (dawn-gradient hero, feature registry driven)
- Pancha Pakshi live calculator — all three input methods (birth details,
  known Nakshatra + Paksha, direct bird), live sunrise-to-next-sunrise
  timetable (timeline / table / week views), current-period tracking with
  clock-skew-corrected countdown, proportional day-overview bar. Pancha
  Pakshi Shastra originates in Tamil Siddha literature (like Vivaha Chakra
  did), but unlike Vivaha Chakra it's independently evidenced as
  naturalized Sri Lankan Sinhala practice, not an unverified stand-in: a
  dedicated Sinhala-language book, *Panchapakshi Shasthraya ha Yamakalaya*
  by O.A. Perera, is sold through M.D. Gunasena (Sri Lanka's oldest
  publisher/bookseller, est. 1885); Sinhala astrology sites (e.g.
  kaladasava.com) present it as ordinary local practice with no
  foreign-import framing; and the five birds carry naturalized Sinhala
  names (Bharunda/Raja Aliya, Bakamuna, Kaka, Kukkuta, Mayura) rather than
  bare transliterations. This doesn't reach Poya/ayanamsa's gazette-tier
  proof, but clears a meaningfully higher bar than "no evidence."
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
  the pinned Pancha Pakshi source tables, bilingual and zero-click on load
  (`/compatibility`, `POST /api/v1/compatibility/birds`). Previously also
  shipped a Vivaha Chakra Palan wedding-date screener; removed once Porondam
  (below) shipped as the actual Sri Lankan wedding-matching standard —
  Vivaha Chakra was a Tamil/pan-Indian method kept only as a stand-in.
- Sinhala Daily Astrology Guide — a Sri Lanka-focused day view combining
  Daily Panchanga, Poya status, avoid times (rahu / yamaganda / gulika),
  sun/moon times, Disha Shool, Tara Bala for known Nakshatra/Paksha
  identities, Chandrashtama when a full birth-derived Moon sign is
  available, current Pancha Pakshi period and favourable windows
  (`/daily-guide`). This composes the existing Panchanga and Pancha Pakshi
  APIs rather than adding a separate calculation engine.
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
- Divisional Charts (D9 Navamsa) — planet and Ascendant placements in the
  ninth-harmonic divisional chart, North Indian diamond layout
  (`/divisional-charts`, `POST /api/v1/divisional-charts/navamsa`).
  Calculation correctness is independently re-derived and verified.
  Layout was researched and corrected: this chart originally rendered in
  the South Indian fixed-square style, but Sri Lankan kendaraya (birth
  charts) use the North Indian diamond convention instead (two
  independent sources agree, including matching structural detail on
  Lagna placement) — fixed to render house-fixed with the rashi rotating
  per Ascendant, matching actual Sri Lankan practice.
- Porondam — Sri Lankan wedding horoscope matching. Ships 7 of the
  traditional 10-12 core Porondama (Nakshatra, Gana, Yoni, Rashi,
  Rashyadpathi, Vashya, Vedha) using standard, cross-tradition (Ashtakoot /
  Tamil Thirumana Porutham) tables — not independently verified against a
  specific Sri Lankan source the way Poya/ayanamsa are (`/porondam`,
  `POST /api/v1/porondam/match`). Vedha's table has one documented edge
  case (Chitra's vedha partner is disputed across sources; resolved as
  "no partner") rather than a recall guess. Rajju was researched and found
  to have real cross-source disagreement on nakshatra groupings — deferred
  pending a single pinned reference. Mahendra and Sthree-Dheerga were also
  researched and found blocked the same way: Mahendra's counting rule is
  consistent across sources but no source supplies a reproducible worked
  example; Sthree-Dheerga's sources disagree on the threshold itself
  (15 / 13 / 7, depending on source). All three remaining core categories
  now share one blocker — no pinnable source with a worked example —
  so Porondam is paused at 7/10 until one turns up. The extended ~10
  traditional categories are deliberately not built yet either — each
  needs a specific, pinned reference first.
- Birth Chart (D1 Rasi) — the main natal chart: planet and Ascendant
  placements by house, North Indian diamond layout matching Sri Lankan
  kendaraya convention (`/birth-chart`, `POST /api/v1/birth-chart/rasi`).
  Whole-sign houses, with per-planet and Ascendant degrees-within-sign
  (e.g. "Sun 15°23′") shown alongside house numbers. Needed zero new vendored-engine
  integration: D1 is `divisional_chart_factor=1` on the same
  `dhasavarga`/`ascendant` calls Divisional Charts already exercises for
  D9. Dasha calculations, asteroid/fixed-star overlays, cusp-based house
  systems (Sripati/KP/Placidus) and divisional-chart cross-linking are
  explicitly out of scope for this module.
- Dasha (Vimshottari planetary periods) — Mahadasha timeline from birth
  (`/dasha`, `POST /api/v1/dasha/mahadasha`): the 9 major planetary
  periods spanning a full ~120-year cycle, with the currently-active
  period highlighted. **v1 ships Mahadasha only** — Antardasha/Bhukti
  sub-period nesting is deferred as an explicit fast-follow, same
  "ship the base feature, add depth later" pattern as Birth Chart's
  sign-only-then-degrees rollout (the engine already supports it,
  golden-tested at `ANTARA` depth in `test_vendor_dasha_engine.py`, but
  v1 doesn't expose it). Needed a real vendoring pass, not just a new
  application module — see `docs/jyotishya-ideas.md` E1 for the full
  history (engine wasn't vendored, then vendored and golden-tested,
  then this module built on top).

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

**Larger future modules** (same registry pattern; unscheduled): birth chart
extensions (asteroid + fixed-star overlays — retained data for these is in
the repo, see `FUTURE_DATA_USES.md`; basic D1 Rasi chart itself has shipped),
festival calendar, Antardasha/Bhukti sub-period depth for Dasha (Mahadasha-
only v1 has shipped — see `docs/jyotishya-ideas.md` E1), and historical/
ancestor chart tools (the BCE–medieval ephemeris the image trims away
remains available for exactly this).

Adding any module should follow the Pancha Pakshi pattern: an isolated
`apps/api/app/modules/<feature>/` backend module, its own feature-registry
entry, palette from `packages/design-system`, and no changes required to
existing modules or the platform shell.

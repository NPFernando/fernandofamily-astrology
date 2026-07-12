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

## Backlog (priority order)

**None of these are implemented.** They must not appear in production
navigation, the sitemap, or anywhere that implies they are available, until
they are actually built, registered in the feature registry
(`packages/feature-registry`), and explicitly enabled.

1. **Auspicious-windows deepening + notifications** — richer window search
   (filter by activity, minimum duration), opt-in web-push alerts before
   favourable/unfavourable periods (PWA push; subscription store in the
   existing astrology database), month heat-map of good/bad density.
2. **Daily Panchanga module** — tithi, nakshatra, yoga, karana, rahu-kala
   daily page. The vendored engine already computes most of this; natural
   second module and a strong SEO surface.
3. **Calendar integration** — export chosen favourable windows as a
   downloadable `.ics` / "Add to Google Calendar" links; no account needed.
4. Telegram bot — "what's my current period?", daily morning summary.
5. Tamil as a third locale (upstream PyJHora ships Tamil resources — see
   [`FUTURE_DATA_USES.md`](../apps/api/vendor/FUTURE_DATA_USES.md); the i18n
   plumbing is locale-count agnostic).
6. Ambient full-screen live view (wall-tablet mode: big countdown, current
   period, auto-refresh).
7. Per-schedule share cards (server-rendered PNG of your day for
   WhatsApp/social).
8. Compatibility mini-tool (two birds' friend/same/enemy relation — the
   relation table already exists).
9. Public API keys + developer docs, per-key rate limits.
10. Activity guidance texts — what each bird-activity combination
    traditionally suits (needs sourced bilingual content).

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

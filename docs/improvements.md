# Improvement recommendations

Audit of the shipped build (engine, API, frontend, PWA, SEO, structure,
performance, ops), prioritized. Effort: S (&lt; half a day), M (a day or two),
L (multi-day). Items reference real code as it exists today — re-verify
against the current tree before acting on an old copy of this document.

## Status (updated after the round-4 implementation pass)

**Round 4 additions:** windows activity/min-duration filters, per-day summary
endpoint (`POST /summary`) + month heat-map view, opt-in web-push alerts
(subscriptions in the astrology DB, ~1km-rounded coordinates, host-cron
dispatch via a loopback-only endpoint), and client-side RFC 5545 `.ics`
export from the week view.

**Shipped since this audit was written:** all four P0s (proxy-aware rate
limiting + idle-bucket eviction, cached engine metadata, per-page metadata
via server components); P1 items 1 (server components), 2 (visual pass:
original bird/activity icons, dawn hero, design tokens now in
`packages/design-system`), 3 (proportional sunrise→sunrise timeline bar),
4 (motion behind `prefers-reduced-motion`), 5 (OG image + JSON-LD),
6 (**auspicious-windows endpoint** `POST /windows` + week view + "Best times
today" card), and 7 (committed Playwright E2E suite, `pnpm e2e`, in CI);
P3's contracts codegen (`packages/contracts/generate.mjs` + CI drift check).
Also shipped beyond the audit: zero-click first result, date navigation,
legend, sticky current bar, saved profiles (local + account sync), the
invite-only auth scaffold, an image-level ephemeris trim
(`apps/api/vendor/FUTURE_DATA_USES.md`), and ten bug fixes from a follow-up
hunt (pool crash guard, stale-closure refetch, profile merge races, search
debounce/abort, skew-consistent timeline, sw.js cache hygiene, and more).

**Still open:** remaining P2 items (install-prompt UX, iOS PWA quirks,
per-page OG variants), web-push notifications, and everything in
`docs/roadmap.md`'s backlog.

## P0 — quick wins / genuine defects

1. **Rate limiter counts all users as one client** (S) —
   `apps/api/app/core/rate_limit.py` keys on `request.client.host`, which
   behind nginx + Docker is always the proxy/bridge address. In production
   every visitor currently shares a single 40 req/min bucket: one heavy user
   can 429 everyone. Fix: run uvicorn with `--proxy-headers
   --forwarded-allow-ips` scoped to the proxy address, or parse the first
   hop of `X-Forwarded-For` in `_client_key` (nginx already sets it), and
   add a regression test that two distinct forwarded IPs get independent
   buckets.
2. **Per-request engine-metadata disk reads** (S) —
   `_engine_metadata()` in `apps/api/app/routes/v1/pancha_pakshi.py`
   re-reads `pin.json` and re-hashes `MANIFEST.sha256` on every schedule /
   birth-bird / current request. The data is immutable for the life of the
   container — compute once at module import (or `functools.lru_cache`).
3. **No per-page titles or descriptions** (S) — only the locale layout has
   `generateMetadata`, so every page (including `/en/pancha-pakshi`) shares
   the platform title. The spec's SEO section wanted "Pancha Pakshi Live
   Timetable | Fernando Family Astrology" etc. Root cause: every page is a
   `"use client"` component, and client files can't export `generateMetadata`.
   Fix alongside P1 item 1 below.
4. **Rate-limit `_hits` dict never evicts idle IPs** (S) — unbounded slow
   memory growth in a long-lived container. Sweep empty buckets when they
   drain, or cap the dict size.

## P1 — high value

1. **Convert static content pages to server components** (M) —
   `about/disclaimer/privacy/licensing/methodology` and the landing page are
   all `"use client"` but render static locale text. Make them server
   components taking `params.locale`, pass the dictionary down, and add
   per-page `generateMetadata` (fixes P0-3, shrinks client JS, improves
   first paint). The interactive calculator page stays client.
5. **Visual design pass** (M/L) — the spec called for sunrise/moon-phase/
   peacock-feather/Sri Lankan palette influences; what shipped is clean but
   generic Tailwind. Concrete steps: a warm sunrise-gradient hero on the
   landing page; per-bird original SVG iconography (5 simple line icons —
   commission or draw, never copy); activity icons next to the existing
   color coding (color is currently the only signal beyond text); a
   peacock-feather-derived accent palette documented in
   `packages/design-system` (currently an empty stub).
6. **True proportional timeline visualization** (M) — the "timeline" view is
   a card list. A horizontal 24h bar (sunrise→sunrise) with proportional
   period widths, a "now" marker that moves, and tap-to-inspect would make
   the core product dramatically more scannable, especially on mobile.
7. **Tasteful motion** (S/M) — animate countdown digit transitions, a subtle
   pulse on the live "now" marker, and an ease-in on period change
   (old current fades, new current highlights). All behind
   `@media (prefers-reduced-motion: no-preference)`. No library needed —
   CSS transitions cover all of it.
8. **OG/social images + structured data** (S/M) — zero `openGraph`/`twitter`
   metadata and no schema.org JSON-LD today. Add one original OG image
   (platform) + one for Pancha Pakshi, per-locale descriptions, and a
   `WebApplication` JSON-LD block.
9. **Auspicious-window endpoint** (M) — "when is the next `very_good`
   sub-period for my bird?" is the question the tool exists to answer, and
   users currently have to expand periods and scan. The engine already
   computes everything needed: add `POST /api/v1/pancha-pakshi/windows`
   (bird + location + date range ≤ 7 days + minimum effect filter),
   and surface it as a "Best times today/this week" card above the timeline.
10. **Real E2E tests** (M) — `apps/web` has only two grep-check scripts; the
   15 E2E scenarios from the spec (§33) were validated manually with
   Playwright but never committed as a suite. Add `apps/web/e2e/` with
   Playwright covering: full direct-bird flow, locale switch retaining
   result (regression for the bug just fixed), no-birth-data-in-URL,
   countdown tick, offline cached-schedule label. Wire into CI against the
   compose stack.

## P2 — nice to have

1. **Pre-index CSV lookups** (S) — `get_matching_rows` linearly scans 3 500
   rows per request. Build a `dict[(bird, weekday, paksha)] → rows` index at
   load; micro-optimization but free.
2. **Multi-day / week schedule endpoint** (M) — batch variant of `/schedule`
   returning up to 7 consecutive sunrise-days; enables a week-view UI and
   halves round-trips for the windows feature above.
3. **Skeleton loading states** (S) — the calculator shows a bare "Loading…"
   string; add skeleton cards for the schedule area so layout doesn't jump.
4. **Install prompt + iOS PWA guidance** (S) — SW and manifest exist, but
   there's no "Add to Home Screen" affordance; iOS needs `apple-touch-icon`
   (PNG — the single SVG icon won't be used by iOS) and a short instruction
   sheet since iOS has no install prompt event.
5. **`/current` response model** (S) — the route returns a bare `dict`;
   give it a typed response model so OpenAPI documents it properly.
6. ~~**Request-ID propagation to clients**~~ — **shipped.** Every response
   carries `X-Request-ID` (`app/core/logging.py`'s `access_log_middleware`
   generates it and sets the header, matching what's logged), making
   user-reported issues traceable. Confirmed 2026-07-21 during a
   performance/ops audit — this entry had gone stale.
7. ~~**Prometheus-style metrics endpoint**~~ — **shipped.** `/metrics`
   (`app/core/metrics.py`) exposes real Prometheus-format counters/histograms
   (request counts and durations by method/path/status), CIDR-gated via
   `metrics_allowed_cidrs`. What's still genuinely open: nothing in this repo
   actually scrapes it — no Prometheus/Grafana config or compose service
   exists anywhere. The endpoint is a foundation, not active monitoring.
8. **Dev one-shot script** (S) — a `make dev` / root `package.json` script
   that starts API venv + web dev server together; today it's two manual
   terminals with an env var.

## P3 — future / structural

1. **Populate `packages/contracts`** (M) — API request/response TypeScript
   types live in `apps/web/lib/api-client.ts`; the contracts package is an
   empty README. Before module #2 (Panchanga etc.), move shared types there
   (ideally generated from the FastAPI OpenAPI schema so they can't drift).
2. **Populate `packages/design-system`** (M) — extract the recurring
   Tailwind patterns (TabButton appears twice already, Fact cards, pill
   buttons) into shared components before a second module copies them a
   third time.
3. **i18n scaling** (M) — both full locale dictionaries are statically
   imported into one bundle via `lib/i18n.ts`; fine at today's size, but
   per-locale dynamic imports (or `next-intl`) will be worth it once a
   second module doubles the dictionary.
4. **Locale-aware number/date formatting helper** (S) — `si-LK`/`en-US`
   ternaries are scattered through components; centralize.
5. **Weekly-view UI, notifications** (L) — "notify me before my next
   very_good window" via Web Push; needs the windows endpoint plus a service
   worker push handler; no server storage of anything personal beyond a push
   subscription endpoint.
6. **In-memory rate-limiter and metrics are per-process** (documented
   limitation, not a bug) — `app/core/rate_limit.py`'s `_hits` dict and
   `app/core/metrics.py`'s counters are plain module-level state, reset on
   restart and not shared across workers. Today's deployment is single
   `uvicorn` process, no `--workers`, no compose `replicas:` — so this is
   inert right now. Before ever adding either, note that it would: multiply
   the effective per-IP rate-limit budget by the worker/replica count, and
   split `/metrics` counters per-process (a scrape only sees whichever
   instance answered). If horizontal scaling is ever needed, this needs a
   shared store (Redis, or similar) first. Recorded 2026-07-21.

## User accounts & data persistence

Guiding principle (unchanged from the privacy posture): **everything works
without an account, all personal data device-local by default.** That's true
today — locale/theme/bird/recent-locations/last-schedule live in
localStorage/sessionStorage only, and `ClearPreferencesButton` wipes it.

Status:

- **Phase A (device-local export/import)** — **not built.** A "Your data"
  section listing device-local keys plus a download/restore-JSON button for
  cross-device portability without any account. Still a small, cheap
  candidate if wanted (S).
- **Phase B (optional Google sign-in, allowlisted)** — **shipped.** Auth.js
  v5, JWT session strategy, feature-flagged hard-off unless
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`AUTH_SECRET` are set;
  `signIn` callback rejects any email not in `AUTH_ALLOWED_EMAILS`. Nothing
  about calculation flows requires it.
- **Phase C (server-side sync)** — **shipped.** `preferences` table in the
  `astrology` Postgres database (`apps/web/db/migrations/001_init.sql`),
  `GET/PUT /api/v1/account/preferences` (authenticated, session-gated),
  syncing locale/theme/default bird/default location. Never raw birth
  date/time or event-specific coordinates — only what the device-local
  version already stored, now optionally mirrored server-side for signed-in
  users.

## Explicitly not recommended

- A self-hosted GitHub runner (already rejected — public repo on a host
  with credentials).
- Client-side fallback astronomical calculation for offline (spec forbids
  it; the cached-and-labeled approach is correct).
- Translating API enum values server-side (breaks the stable-contract
  design; translation stays in the frontend).

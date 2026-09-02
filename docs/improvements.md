# Improvement recommendations

Audit of the shipped build (engine, API, frontend, PWA, SEO, structure,
performance, ops), prioritized. Effort: S (&lt; half a day), M (a day or two),
L (multi-day). Items reference real code as it exists today — re-verify
against the current tree before acting on an old copy of this document.

## Status (updated after the round-5 implementation pass)

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

**Round 5 additions:** pre-indexed Pancha Pakshi lookups, the typed
multi-day schedule endpoint, standardized skeleton loading states, a typed
`/current` response, the one-shot dev script, generated contract artifacts
with a web-client boundary check, and the shared locale date/number formatter.

**Still open:** i18n dictionary code-splitting and promotion of shared UI
primitives into the design-system package once another app needs them. The
product roadmap currently has no selected backlog module.

## P0 — quick wins / genuine defects

1. ~~**Rate limiter counts all users as one client**~~ — **shipped.**
   Proxy-aware client keys and independent forwarded-IP buckets are covered
   by the API rate-limit regression tests.
2. ~~**Per-request engine-metadata disk reads**~~ — **shipped.** Engine
   metadata and integrity hashes are cached for the container lifetime.
3. ~~**No per-page titles or descriptions**~~ — **shipped.** Locale-scoped
   server page wrappers use `localizedPageMetadata`, with canonical/hreflang,
   localized title/description, and per-feature social imagery.
4. ~~**Rate-limit `_hits` dict never evicts idle IPs**~~ — **shipped.** Idle
   buckets are removed as they drain, preventing unbounded memory growth.

## P1 — high value

1. ~~**Convert static content pages to server components**~~ — **shipped.**
   Static locale pages use server wrappers and localized metadata; the
   interactive calculator remains client-rendered.
5. ~~**Visual design pass**~~ — **shipped.** The landing hero, bird/activity
   icons, and shared palette tokens are implemented in the design system.
6. ~~**True proportional timeline visualization**~~ — **shipped.** The
   schedule timeline uses sunrise-to-sunrise proportional widths with a live
   marker and period inspection.
7. ~~**Tasteful motion**~~ — **shipped.** Countdown and current-period
   transitions are CSS-based and disabled for reduced-motion users.
8. ~~**OG/social images + structured data**~~ — **shipped.** The generated
   default and per-feature 1200×630 social cards are mapped by
   `feature-assets.ts` into OpenGraph/Twitter metadata and are covered by
   Playwright; the locale layout provides `WebApplication` JSON-LD.
9. ~~**Auspicious-window endpoint**~~ — **shipped.** `/windows`, filters,
   and the "Best times" cards power the timeline and week view.
10. ~~**Real E2E tests**~~ — **shipped.** The committed Playwright suite
   covers the core calculation, locale, privacy, countdown, and offline
   scenarios and runs in CI.

## P2 — nice to have

1. ~~**Pre-index CSV lookups**~~ — **shipped.** `get_matching_rows` uses a
   `(bird, weekday, paksha)` index built at load time.
2. ~~**Multi-day / week schedule endpoint**~~ — **shipped.** The batch variant
   returning up to 7 consecutive sunrise-days; enables a week-view UI and
   halves round-trips for the windows feature above.
3. ~~**Skeleton loading states**~~ — **shipped.** Shared skeleton cards keep
   schedule layouts stable while data loads.
4. ~~**Install prompt + iOS PWA guidance**~~ — **shipped.** The install
   affordance, iOS instruction sheet, Apple touch icon, offline shell status,
   and user-controlled service-worker refresh flow are covered by Playwright.
5. ~~**`/current` response model**~~ — **shipped.** The route and generated
   OpenAPI schema expose a typed response model.
6. ~~**Request-ID propagation to clients**~~ — **shipped.** Every response
   carries `X-Request-ID` (`app/core/logging.py`'s `access_log_middleware`
   generates it and sets the header, matching what's logged), making
   user-reported issues traceable. Confirmed 2026-07-21 during a
   performance/ops audit — this entry had gone stale.
7. ~~**Prometheus-style metrics endpoint**~~ — **shipped.** `/metrics`
   (`app/core/metrics.py`) exposes real Prometheus-format counters/histograms
   (request counts and durations by method/path/status), CIDR-gated via
   `metrics_allowed_cidrs`. The opt-in production monitoring profile now
   scrapes it with Prometheus, probes the public HTTPS `/en` and readiness
   endpoints through Blackbox exporter (including certificate-expiry alerts),
   delivers Alertmanager webhook notifications, and provisions a loopback-only
   Grafana dashboard; an hourly GitHub-hosted public smoke workflow adds an
   off-host check. See
   `docs/deployment/monitoring.md`.
8. ~~**Dev one-shot script**~~ — **shipped.** `make dev` starts the API and
   web development servers together.

## P3 — future / structural

1. ~~**Populate `packages/contracts`**~~ — **shipped.** OpenAPI artifacts are
   generated in CI and the web client uses generated response types at
   endpoint boundaries, with assignability checks for the remaining client
   models.
2. **Populate `packages/design-system`** (M) — tokens are shared today;
   extract recurring Tailwind patterns (TabButton, fact cards, and pill
   buttons) only when a second app/module needs the same primitives.
3. **i18n scaling** (M) — both full locale dictionaries are statically
   imported into one bundle via `lib/i18n.ts`; fine at today's size, but
   per-locale dynamic imports (or `next-intl`) will be worth it once a
   second module doubles the dictionary.
4. ~~**Locale-aware number/date formatting helper**~~ — **shipped.**
   `apps/web/lib/formatters.ts` centralizes locale-aware display formatting.
5. ~~**Weekly-view UI, notifications**~~ — **shipped.** The week view and
   opt-in web-push alerts are live, with only privacy-preserving subscription
   metadata stored server-side.
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

- **Phase A (device-local vault backup/restore)** — **shipped.** The privacy
  page downloads and restores only the encrypted vault ciphertext plus its
  KDF salt; raw values and the passphrase are never exported. Restore is
  fail-closed when a device already has a vault, and requires the original
  passphrase before any private data is readable. Non-sensitive saved
  profiles remain separate and can already sync through an optional account.
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

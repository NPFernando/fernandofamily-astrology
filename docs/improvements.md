# Improvement recommendations

Audit of the shipped build (engine, API, frontend, PWA, SEO, structure,
performance, ops), prioritized. Effort: S (&lt; half a day), M (a day or two),
L (multi-day). Items reference real code as it exists today — re-verify
against the current tree before acting on an old copy of this document.

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
6. **Request-ID propagation to clients** (S) — access logs have request IDs
   but responses don't carry an `X-Request-ID` header; add it to make
   user-reported issues traceable.
7. **Prometheus-style metrics endpoint** (M) — request counts/durations are
   only in logs; a `/metrics` endpoint (guarded to loopback via nginx) would
   let the host's existing monitoring scrape it.
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

## User accounts & data persistence (design, not yet built)

Guiding principle (unchanged from the privacy posture): **everything works
without an account, all personal data device-local by default.** That's
already true today — locale/theme/bird/recent-locations/last-schedule live
in localStorage/sessionStorage only.

Phased design:

- **Phase A (now / no server changes)**: add an explicit "Your data" section
  on the Privacy page enumerating device-local keys (exists) plus an
  export/import button (download/restore a JSON of preferences) — gives
  cross-device portability with zero auth. (S)
- **Phase B (optional Google sign-in, allowlisted)**: Auth.js v5 (`next-auth@5`)
  with the Google provider, JWT session strategy (no database needed for
  sign-in itself). Feature-flagged hard-off unless `GOOGLE_CLIENT_ID`/
  `GOOGLE_CLIENT_SECRET`/`AUTH_SECRET` are set; `signIn` callback rejects
  any email not in `AUTH_ALLOWED_EMAILS` (initially exactly
  `fernandonaveen2000@gmail.com`). UI: a small avatar/sign-in button in the
  Nav, rendered only when the flag is on. Nothing about calculation flows
  may ever require it. (M)
  - **Why Auth.js v5 over alternatives**: first-class App Router support
    (route handlers + middleware), JWT-only mode means no DB dependency for
    phase B, Google provider is a 10-line config, and it's the de-facto
    standard so future providers are drop-in. Clerk/Auth0 are hosted
    third-party dependencies (conflicts with the self-contained posture and
    adds cost); Lucia is deprecated; hand-rolled OAuth is avoidable risk.
- **Phase C (server-side sync, later)**: a small `user_prefs` store keyed by
  the Google account subject, holding exactly what localStorage holds today
  (never raw birth data — sync the *derived* bird, not birth details, unless
  the user explicitly opts in to storing birth inputs). Storage options:
  - *SQLite file volume*: zero new infra, one more thing to back up,
    fine at this scale; slightly awkward with the read-only container
    filesystem (needs a writable volume).
  - *Host's existing Postgres 18 instance*: already backed up nightly and
    restore-verified, one new database + role; couples the app to host
    infra, which is acceptable for this deployment but should stay behind a
    `DATABASE_URL` env var so self-hosters can use anything.
  Decision can wait until phase C is actually scheduled; the API surface
  (`GET/PUT /api/v1/user/preferences`, authenticated) is the stable part.

## Explicitly not recommended

- A self-hosted GitHub runner (already rejected — public repo on a host
  with credentials).
- Client-side fallback astronomical calculation for offline (spec forbids
  it; the cached-and-labeled approach is correct).
- Translating API enum values server-side (breaks the stable-contract
  design; translation stays in the frontend).

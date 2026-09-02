# Platform architecture

## Monorepo layout

```
apps/web/       Next.js frontend (App Router, TypeScript, bilingual, PWA)
apps/api/       FastAPI backend (stateless calculation API)
packages/       Shared contracts, design system, feature registry
infra/          Docker, Caddy (reference), deployment scripts
docs/           This documentation
```

## Feature registry

The platform is designed to host more than one astrology tool over time,
without coupling the site shell to any single one. `packages/feature-registry`
holds a single typed list of feature entries (id, route, API namespace,
enabled/public flags, nav ordering, i18n keys). The frontend's navigation,
sitemap generation, and route guards all read from this one list — a
disabled or non-public feature never appears in navigation, never appears in
`sitemap.xml`, and its route is not reachable, without needing any
feature-specific conditional logic scattered across the codebase.

Adding a new tool later means adding a new entry here plus a new isolated
module under `apps/api/app/modules/<feature>/` and `apps/web/components/<feature>/`
— it should not require touching the Pancha Pakshi module or the platform
shell. See [`../roadmap.md`](../roadmap.md) for what's intentionally not
built yet.

## Backend architecture

The API is stateless — no database, no user accounts, no server-side
storage of birth data. Every request that computes something does so fresh,
from the request body, using the vendored calculation engine. The one thing
that persists across requests is the vendored, checksummed PyJHora source
and the Pancha Pakshi lookup table it ships (`apps/api/vendor/jhora/data/pancha_pakshi_db.csv`),
which is read-only application data, not user data.

Layering inside `apps/api/app/modules/pancha_pakshi/`:

- `adapter.py` — the only module that imports the vendored `jhora` package.
  Thin, faithful wrappers around its astronomy/panchanga primitives, nothing
  else. No route or frontend code ever depends on PyJHora's own tuple
  positions, localized strings, or image paths.
- `calculator.py` — reimplements the reference schedule-construction
  algorithm (see [`../calculations/schedule.md`](../calculations/schedule.md))
  against normalized, enum-typed models, with invariants asserted before
  anything is returned.
- `repository.py` — the CSV lookup table and the integer-to-enum mapping
  tables, each documented against exactly which upstream list they mirror.
- `models.py`, `enums.py`, `validation.py`, `service.py` — typed request/response
  shapes, stable internal enums (never translated strings), input validation,
  and the three birth-bird input method entrypoints.

## Frontend architecture

Next.js App Router under `app/[locale]/`, bilingual (English/Sinhala) via
locale-scoped routes, with all user-facing strings sourced from
`apps/web/locales/{en,si}.json` — never hardcoded in components. A PWA
service worker caches only the app shell for offline viewing. Calculation API
responses are never cached by the worker; an unlocked vault may separately
hold the last schedule, explicitly labeled as cached rather than presented as
live. Waiting worker updates activate only after the visitor chooses Refresh
(see [`../roadmap.md`](../roadmap.md) and the privacy page for what's cached
client-side, and why nothing sensitive is).

The private vault is portable only as an encrypted backup containing its
ciphertext and KDF salt; it never exports a passphrase or decrypted values.
Import refuses to overwrite an existing vault, and the restored data remains
locked until its original passphrase is supplied. Users can also lock it
explicitly: that drops the in-memory key and remounts calculator UI state,
leaving only encrypted ciphertext in browser storage.

Passphrase rotation uses a short-lived browser-storage journal containing only
the previous and next AES-GCM ciphertext pairs plus their public KDF salts.
If a tab closes mid-rotation, the next vault operation restores the previous
authenticated pair rather than leaving private data unreadable.

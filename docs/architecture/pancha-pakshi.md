# Pancha Pakshi module architecture

## API surface

```
POST /api/v1/pancha-pakshi/birth-bird   birth-bird confirmation (methods A/B)
POST /api/v1/pancha-pakshi/schedule     full schedule (methods A/B/C)
POST /api/v1/pancha-pakshi/current      current + next period only (lighter weight)
GET  /api/v1/pancha-pakshi/metadata     engine version/commit/checksums (cacheable)
```

All three POST routes accept a discriminated-union JSON body
(`{"method": "birth_datetime" | "nakshatra_paksha" | "bird", ...}`) — never
query parameters — enforced structurally by a test that inspects the
generated OpenAPI schema and fails if any `GET` route ever references a
birth- or location-precision field.

## Why POST-only, and why nothing is logged

Birth date, time, and precise coordinates are the closest thing this app
handles to sensitive personal data. They're used only for the single
calculation requested, never persisted, and structural safeguards keep them
out of every place they could otherwise leak: URLs (browser history, proxy
logs, referrer headers), application logs (an explicit allow-list of
loggable fields, not a deny-list — new fields default to *not* being
logged), and any future caching layer (a cache key, if one is ever added,
must be a hash of the canonicalized input, never the raw input itself).

See [`../privacy.md`](../privacy.md) for the full privacy posture.

## Layering

See [`platform.md`](platform.md#backend-architecture) for the
`adapter.py` / `calculator.py` / `repository.py` layering. The short version:
routes call `service.py`, which calls `calculator.py`, which calls
`adapter.py` for anything that needs the vendored engine — nothing above
`adapter.py` ever touches the vendored `jhora` package directly, so the
calculation engine could in principle be swapped or upgraded without
touching route or model code, as long as the new engine can produce the
same normalized primitives (sunrise/sunset/day length/night length/weekday/
Paksha/Nakshatra/birth-bird/matching lookup rows).

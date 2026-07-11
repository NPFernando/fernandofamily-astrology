# Fernando Family Astrology

Open-source bilingual (English / Sinhala) astrology platform powering
[astrology.fernandofamily.com](https://astrology.fernandofamily.com), starting
with an accurate, live **Pancha Pakshi** timetable.

> This repository is under active initial development. See
> [`docs/roadmap.md`](docs/roadmap.md) for what's implemented vs. planned.

## Calculation engine

Calculations are powered by [PyJHora](https://github.com/naturalstupid/PyJHora),
pinned to release `V4.8.7` (commit `ca22995`), licensed AGPL-3.0. See
[`docs/licensing.md`](docs/licensing.md) for full attribution and the safe
upgrade process, and [`apps/api/vendor/MANIFEST.sha256`](apps/api/vendor/MANIFEST.sha256)
for the checksummed vendored source.

## License

AGPL-3.0 — see [`LICENSE`](LICENSE), [`NOTICE.md`](NOTICE.md), and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Monorepo layout

```
apps/web/     Next.js frontend (App Router, TypeScript, bilingual, PWA)
apps/api/     FastAPI backend (Pancha Pakshi calculation API)
packages/     Shared contracts, design system, feature registry
infra/        Docker, Caddy (reference), deployment tooling
docs/         Architecture, calculations, deployment, licensing docs
```

Further setup, development, and deployment instructions will be added as each
part of the platform lands.

## What does this change, and why?

## Checklist

- [ ] `pytest apps/api/tests` and `ruff check` pass (if backend touched)
- [ ] Golden tests still pass unmodified (if `calculator.py`/`repository.py` touched)
- [ ] `npx tsc --noEmit`, `pnpm lint`, `pnpm build`, `pnpm test` pass (if frontend touched)
- [ ] Both `locales/en.json` and `locales/si.json` updated together (if user-facing text changed)
- [ ] No birth date/time/precise-location field added to a `GET` route, URL, log line, or cache key
- [ ] Vendored engine source / checksum manifest not hand-edited (if touched, see `docs/licensing.md`)

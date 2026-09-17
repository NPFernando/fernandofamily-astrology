# Accessibility checks

The web E2E suite includes `tests/e2e/accessibility.spec.ts`. It runs against
the production standalone build and checks the main public routes with axe's
WCAG 2A/2AA rules. The same test also checks that visible controls expose an
accessible name and that keyboard Tab navigation keeps a visible focus target.

Run the full browser gate from `apps/web` with:

```sh
pnpm e2e
```

The gate is intentionally browser-based: static markup checks cannot prove
hydrated labels, modal controls, focus behavior, or the accessibility tree.
If a reused local Playwright server is stale, stop the old standalone server
or run without `PLAYWRIGHT_REUSE_SERVER=1` before retrying.

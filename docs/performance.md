# Frontend performance budget

The production web build has a checked-in artifact budget:

- JavaScript: 1,750,000 bytes total
- CSS: 100,000 bytes total
- Largest JavaScript chunk: 300,000 bytes

Run `pnpm build` from `apps/web`, then `pnpm run check:bundle`. The check
measures `.next/static` and fails closed when the build is missing or a budget
is exceeded. The limits are intentionally above the current build's measured
1,447,779 bytes of JavaScript, 74,556 bytes of CSS, and 228,914-byte largest
JavaScript chunk, leaving room for normal changes while preventing silent
growth.

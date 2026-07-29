# Heritage visual assets

The current visual system is intentionally text-free at the asset level so
the UI can supply accurate English and Sinhala copy accessibly.

## Sources and output

- `source/landing-heritage-v2.png` — original raster hero artwork. It uses
  Sri Lankan lagoon, moonstone, lotus, Bodhi-leaf and ola-leaf-inspired cues;
  it contains no people, Buddha figures or sacred emblems.
- `features/*.png` — generated from the deterministic heritage-poster script.
  These are the source PNGs for the matching WebP posters under
  `public/posters/features/`.
- `public/icons/app/` and `public/og/` are derived deliverables, never hand
  edited.

## Regeneration

From `apps/web`, run:

```bash
pnpm assets:heritage
```

The OG renderer needs a Sinhala-capable system font (for example
`fonts-noto-core`) so it will stop rather than create invalid Sinhala glyphs.
Generated artwork must retain the established respect policy: cultural cues
are welcome, but sacred figures and emblems are not decorative UI assets.

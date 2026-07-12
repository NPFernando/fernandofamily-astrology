# design-system

Shared design tokens for the platform — `tokens.ts` is the single source of
truth for the activity/effect color palettes, accent colors, hero gradient
stops, and timeline tint colors.

`apps/web` consumes these via the `@fernandofamily/design-system` tsconfig
path (with a thin re-export at
`apps/web/components/pancha-pakshi/activityColors.ts` for pre-existing import
sites). **Future astrology modules must import palette values from here**
rather than redefining them, so the platform stays visually coherent as
tools are added.

UI primitives (buttons, cards) still live in `apps/web/components/`; promote
them here only when a second app/module actually needs them.

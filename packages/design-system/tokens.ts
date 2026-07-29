// Design tokens for the Fernando Family Astrology platform — the single
// source of truth for colors shared across current and future modules.
// apps/web consumes these (see apps/web/components/pancha-pakshi/
// activityColors.ts, which re-exports for existing import sites); any new
// astrology module must import from here rather than redefining palette
// values.

export type ActivityKey = "ruling" | "eating" | "walking" | "sleeping" | "dying";
export type EffectKey = "very_bad" | "bad" | "average" | "good" | "very_good";

// Spec's suggested activity styling (§25). Color is never the only signal —
// every consumer also renders the localized activity label and/or icon.
export const ACTIVITY_COLORS: Record<ActivityKey, string> = {
  ruling: "#15803d", // dark green
  eating: "#ca8a04", // gold
  walking: "#0f766e", // teal
  sleeping: "#c2410c", // orange
  dying: "#b91c1c", // red
};

// Mirrors upstream PyJHora's effect color ordering (red -> dark green).
export const EFFECT_COLORS: Record<EffectKey, string> = {
  very_bad: "#b91c1c",
  bad: "#c2410c",
  average: "#ca8a04",
  good: "#65a30d",
  very_good: "#15803d",
};

// Sunrise amber accent — light and dark theme values (globals.css maps these
// onto the --accent custom property).
export const ACCENT = {
  light: "#8a5a16",
  dark: "#f2c56b",
};

// Sri Lankan craft-inspired foundation. These are semantic *brand* colors;
// activity/effect colors above remain functional data colors and must never be
// replaced by decorative palette choices.
export const HERITAGE_COLORS = {
  indigo: "#13213f",
  indigoDeep: "#0b1327",
  templeStone: "#f6f0e5",
  brass: "#b88a35",
  saffron: "#b85d28",
  lotusTeal: "#216d68",
  ink: "#211a14",
};

// Landing hero gradients: dawn (light theme) and dusk (dark theme), deep
// indigo through violet into amber/gold. Pure CSS stops, no image assets.
export const HERO_GRADIENT = {
  dawn: ["#1e1b4b", "#4c1d95", "#b45309", "#f5b942"],
  dusk: ["#0b0a1c", "#312e81", "#7c2d12", "#b45309"],
};

// Day/night tint layers behind the proportional timeline bar (warm day,
// cool night). Kept as rgba here since consumers apply their own opacity
// variants per theme; the Tailwind classes in DayTimelineBar mirror these.
export const TIMELINE_TINTS = {
  day: "#fde68a", // amber-200 family
  night: "#1e1b4b", // indigo-950 family
};

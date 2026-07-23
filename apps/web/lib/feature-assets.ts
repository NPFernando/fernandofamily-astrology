export const FEATURE_VISUAL_IDS = [
  "birth-nakshatra",
  "pancha-pakshi",
  "panchanga",
  "moon-calendar",
  "daily-guide",
  "family-almanac",
  "muhurta",
  "compatibility",
  "divisional-charts",
  "porondam",
  "birth-chart",
  "dasha",
] as const;

export type FeatureVisualId = (typeof FEATURE_VISUAL_IDS)[number];

export const DEFAULT_OG_IMAGE = "/og/og-default.png";
export const LANDING_POSTER = "/posters/landing-almanac.webp";

export const FEATURE_POSTERS: Record<FeatureVisualId, string> = {
  "birth-nakshatra": "/posters/features/birth-nakshatra.webp",
  "pancha-pakshi": "/posters/features/pancha-pakshi.webp",
  panchanga: "/posters/features/panchanga.webp",
  "moon-calendar": "/posters/features/moon-calendar.webp",
  "daily-guide": "/posters/features/daily-guide.webp",
  "family-almanac": "/posters/features/family-almanac.webp",
  muhurta: "/posters/features/muhurta.webp",
  compatibility: "/posters/features/compatibility.webp",
  "divisional-charts": "/posters/features/divisional-charts.webp",
  porondam: "/posters/features/porondam.webp",
  "birth-chart": "/posters/features/birth-chart.webp",
  dasha: "/posters/features/dasha.webp",
};

export const FEATURE_OG_IMAGES: Record<FeatureVisualId, string> = {
  "birth-nakshatra": "/og/birth-nakshatra.png",
  "pancha-pakshi": "/og/pancha-pakshi.png",
  panchanga: "/og/panchanga.png",
  "moon-calendar": "/og/moon-calendar.png",
  "daily-guide": "/og/daily-guide.png",
  "family-almanac": "/og/family-almanac.png",
  muhurta: "/og/muhurta.png",
  compatibility: "/og/compatibility.png",
  "divisional-charts": "/og/divisional-charts.png",
  porondam: "/og/porondam.png",
  "birth-chart": "/og/birth-chart.png",
  dasha: "/og/dasha.png",
};

export function isFeatureVisualId(value: string): value is FeatureVisualId {
  return (FEATURE_VISUAL_IDS as readonly string[]).includes(value);
}

export function featureVisualFromPath(path: string): FeatureVisualId | null {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  return isFeatureVisualId(normalized) ? normalized : null;
}

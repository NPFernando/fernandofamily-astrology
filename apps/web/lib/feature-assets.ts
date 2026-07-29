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
  "horoscope-report",
  "dasha",
] as const;

export type FeatureVisualId = (typeof FEATURE_VISUAL_IDS)[number];

export const DEFAULT_OG_IMAGE = "/og/og-default.png";
export const LANDING_POSTER = "/posters/landing-heritage-v2.webp";
export const LANDING_POSTER_AVIF = "/posters/landing-heritage-v2.avif";
export const LANDING_POSTER_FALLBACK = "/posters/landing-heritage-v2.jpg";

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
  "horoscope-report": "/posters/features/horoscope-report.webp",
  dasha: "/posters/features/dasha.webp",
};

export const FEATURE_POSTER_AVIFS: Record<FeatureVisualId, string> = {
  "birth-nakshatra": "/posters/features/birth-nakshatra.avif",
  "pancha-pakshi": "/posters/features/pancha-pakshi.avif",
  panchanga: "/posters/features/panchanga.avif",
  "moon-calendar": "/posters/features/moon-calendar.avif",
  "daily-guide": "/posters/features/daily-guide.avif",
  "family-almanac": "/posters/features/family-almanac.avif",
  muhurta: "/posters/features/muhurta.avif",
  compatibility: "/posters/features/compatibility.avif",
  "divisional-charts": "/posters/features/divisional-charts.avif",
  porondam: "/posters/features/porondam.avif",
  "birth-chart": "/posters/features/birth-chart.avif",
  "horoscope-report": "/posters/features/horoscope-report.avif",
  dasha: "/posters/features/dasha.avif",
};

export const FEATURE_POSTER_FALLBACKS: Record<FeatureVisualId, string> = {
  "birth-nakshatra": "/posters/features/birth-nakshatra.jpg",
  "pancha-pakshi": "/posters/features/pancha-pakshi.jpg",
  panchanga: "/posters/features/panchanga.jpg",
  "moon-calendar": "/posters/features/moon-calendar.jpg",
  "daily-guide": "/posters/features/daily-guide.jpg",
  "family-almanac": "/posters/features/family-almanac.jpg",
  muhurta: "/posters/features/muhurta.jpg",
  compatibility: "/posters/features/compatibility.jpg",
  "divisional-charts": "/posters/features/divisional-charts.jpg",
  porondam: "/posters/features/porondam.jpg",
  "birth-chart": "/posters/features/birth-chart.jpg",
  "horoscope-report": "/posters/features/horoscope-report.jpg",
  dasha: "/posters/features/dasha.jpg",
};

export const POSTER_RESPONSIVE_WIDTHS = [480, 960, 1440] as const;

export function posterSrcSet(src: string) {
  const responsiveSources = POSTER_RESPONSIVE_WIDTHS.map((width) =>
    `${src.replace(/(\.(?:avif|webp|jpg))$/, `-${width}$1`)} ${width}w`,
  );
  return [...responsiveSources, `${src} 1920w`].join(", ");
}

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
  "horoscope-report": "/og/horoscope-report.png",
  dasha: "/og/dasha.png",
};

export function isFeatureVisualId(value: string): value is FeatureVisualId {
  return (FEATURE_VISUAL_IDS as readonly string[]).includes(value);
}

export function featureVisualFromPath(path: string): FeatureVisualId | null {
  const normalized = path.replace(/^\/+|\/+$/g, "");
  return isFeatureVisualId(normalized) ? normalized : null;
}

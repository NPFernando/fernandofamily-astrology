export type FeatureEntry = {
  id: string;
  enabled: boolean;
  public: boolean;
  order: number;
  route: string;
  apiNamespace: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
};

// Single source of truth for which astrology tools are live. Nav, sitemap
// generation, and route guards all read from this list — a feature must be
// added here, enabled, and public before it can appear or be reachable
// anywhere on the site. See ../../docs/roadmap.md for what's intentionally
// not here yet.
export const features: FeatureEntry[] = [
  {
    id: "pancha-pakshi",
    enabled: true,
    public: true,
    order: 10,
    route: "/pancha-pakshi",
    apiNamespace: "/api/v1/pancha-pakshi",
    titleKey: "features.panchaPakshi.title",
    descriptionKey: "features.panchaPakshi.description",
    icon: "peacock",
  },
  {
    id: "panchanga",
    enabled: true,
    public: true,
    order: 20,
    route: "/panchanga",
    apiNamespace: "/api/v1/panchanga",
    titleKey: "features.panchanga.title",
    descriptionKey: "features.panchanga.description",
    icon: "sun",
  },
];

export function enabledFeatures(): FeatureEntry[] {
  return features
    .filter((f) => f.enabled && f.public)
    .sort((a, b) => a.order - b.order);
}

export function isRouteEnabled(route: string): boolean {
  return enabledFeatures().some((f) => f.route === route);
}

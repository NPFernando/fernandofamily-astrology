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
    id: "birth-nakshatra",
    enabled: true,
    public: true,
    order: 5,
    route: "/birth-nakshatra",
    apiNamespace: "/api/v1/birth-nakshatra",
    titleKey: "features.birthNakshatra.title",
    descriptionKey: "features.birthNakshatra.description",
    icon: "birth-nakshatra",
  },
  {
    id: "pancha-pakshi",
    enabled: true,
    public: true,
    order: 10,
    route: "/pancha-pakshi",
    apiNamespace: "/api/v1/pancha-pakshi",
    titleKey: "features.panchaPakshi.title",
    descriptionKey: "features.panchaPakshi.description",
    icon: "pancha-pakshi",
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
    icon: "panchanga",
  },
  {
    id: "moon-calendar",
    enabled: true,
    public: true,
    order: 22,
    route: "/moon-calendar",
    apiNamespace: "/api/v1/panchanga",
    titleKey: "features.moonCalendar.title",
    descriptionKey: "features.moonCalendar.description",
    icon: "moon-calendar",
  },
  {
    id: "daily-guide",
    enabled: true,
    public: true,
    order: 25,
    route: "/daily-guide",
    apiNamespace: "/api/v1",
    titleKey: "features.dailyGuide.title",
    descriptionKey: "features.dailyGuide.description",
    icon: "daily-guide",
  },
  {
    id: "family-almanac",
    enabled: true,
    public: true,
    order: 26,
    route: "/family-almanac",
    apiNamespace: "/api/v1",
    titleKey: "features.familyAlmanac.title",
    descriptionKey: "features.familyAlmanac.description",
    icon: "family-almanac",
  },
  {
    id: "muhurta",
    enabled: true,
    public: true,
    order: 27,
    route: "/muhurta",
    apiNamespace: "/api/v1/muhurta",
    titleKey: "features.muhurta.title",
    descriptionKey: "features.muhurta.description",
    icon: "muhurta",
  },
  {
    id: "compatibility",
    enabled: true,
    public: true,
    order: 30,
    route: "/compatibility",
    apiNamespace: "/api/v1/compatibility",
    titleKey: "features.compatibility.title",
    descriptionKey: "features.compatibility.description",
    icon: "compatibility",
  },
  {
    id: "divisional-charts",
    enabled: true,
    public: true,
    order: 35,
    route: "/divisional-charts",
    apiNamespace: "/api/v1/divisional-charts",
    titleKey: "features.divisionalCharts.title",
    descriptionKey: "features.divisionalCharts.description",
    icon: "divisional-charts",
  },
  {
    id: "porondam",
    enabled: true,
    public: true,
    order: 40,
    route: "/porondam",
    apiNamespace: "/api/v1/porondam",
    titleKey: "features.porondam.title",
    descriptionKey: "features.porondam.description",
    icon: "porondam",
  },
  {
    id: "birth-chart",
    enabled: true,
    public: true,
    order: 45,
    route: "/birth-chart",
    apiNamespace: "/api/v1/birth-chart",
    titleKey: "features.birthChart.title",
    descriptionKey: "features.birthChart.description",
    icon: "birth-chart",
  },
  {
    id: "horoscope-report",
    enabled: true,
    public: true,
    order: 47,
    route: "/horoscope-report",
    apiNamespace: "/api/v1",
    titleKey: "features.horoscopeReport.title",
    descriptionKey: "features.horoscopeReport.description",
    icon: "horoscope-report",
  },
  {
    id: "dasha",
    enabled: true,
    public: true,
    order: 50,
    route: "/dasha",
    apiNamespace: "/api/v1/dasha",
    titleKey: "features.dasha.title",
    descriptionKey: "features.dasha.description",
    icon: "dasha",
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

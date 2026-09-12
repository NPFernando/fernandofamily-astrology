import featureData from "./features.json";

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

// Single source of truth for which astrology tools are live. The JSON file is
// also consumed by the API metadata route and copied into the API image.
export const features: FeatureEntry[] = featureData;

export function enabledFeatures(): FeatureEntry[] {
  return features
    .filter((f) => f.enabled && f.public)
    .sort((a, b) => a.order - b.order);
}

export function isRouteEnabled(route: string): boolean {
  return enabledFeatures().some((f) => f.route === route);
}

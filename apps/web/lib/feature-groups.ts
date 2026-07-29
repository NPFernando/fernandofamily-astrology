import type { FeatureEntry } from "@fernandofamily/feature-registry";

export const FEATURE_GROUPS = [
  {
    id: "today",
    featureIds: ["daily-guide", "panchanga", "moon-calendar", "pancha-pakshi", "muhurta"],
  },
  {
    id: "birth",
    featureIds: ["birth-nakshatra", "birth-chart", "divisional-charts", "horoscope-report", "dasha"],
  },
  {
    id: "family",
    featureIds: ["family-almanac", "compatibility", "porondam"],
  },
] as const;

export type FeatureGroupId = (typeof FEATURE_GROUPS)[number]["id"];

export function groupedFeatures(features: FeatureEntry[]) {
  return FEATURE_GROUPS.map((group) => ({
    ...group,
    features: group.featureIds
      .map((id) => features.find((feature) => feature.id === id))
      .filter((feature): feature is FeatureEntry => Boolean(feature)),
  }));
}

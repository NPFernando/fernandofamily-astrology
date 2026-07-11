import type { ActivityId } from "@/lib/api-client";

// Spec's suggested activity styling (§25). Color is never the only signal —
// every place this is used also renders the localized activity label.
export const ACTIVITY_COLORS: Record<ActivityId, string> = {
  ruling: "#15803d", // dark green
  eating: "#ca8a04", // gold
  walking: "#0f766e", // teal
  sleeping: "#c2410c", // orange
  dying: "#b91c1c", // red
};

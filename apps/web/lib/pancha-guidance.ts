import type { ActivityId, EffectId, SubPeriod } from "@/lib/api-client";
import type { getDictionary } from "@/lib/i18n";

type Dictionary = ReturnType<typeof getDictionary>;

// Locale-authored summaries of traditional Pancha Pakshi activity/effect
// usage. Source notes live in docs/calculations/schedule.md; this helper keeps
// the UI wiring typed without changing the API contract.
export function activityGuidance(dict: Dictionary, activity: ActivityId): string {
  return dict.guidance.activities[activity];
}

export function effectGuidance(dict: Dictionary, effect: EffectId): string {
  return dict.guidance.effects[effect];
}

export function subPeriodGuidance(dict: Dictionary, period: SubPeriod) {
  return {
    activity: activityGuidance(dict, period.sub_activity),
    effect: effectGuidance(dict, period.effect),
    disclaimer: dict.guidance.disclaimer,
    title: dict.guidance.title,
  };
}

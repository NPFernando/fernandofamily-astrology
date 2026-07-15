"use client";

import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { ActivityId, EffectId } from "@/lib/api-client";
import { ACTIVITY_COLORS } from "./activityColors";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { activityGuidance, effectGuidance } from "@/lib/pancha-guidance";

const ACTIVITIES: ActivityId[] = ["ruling", "eating", "walking", "sleeping", "dying"];
const EFFECTS: EffectId[] = ["very_good", "good", "average", "bad", "very_bad"];

export function Legend() {
  const { dict } = useLocale();
  return (
    <details className="rounded-xl border border-black/10 px-4 py-3 text-sm dark:border-white/10 print:hidden">
      <summary className="cursor-pointer select-none font-medium opacity-80">{dict.ui.legend}</summary>
      <div data-testid="guidance-legend" className="mt-3 flex flex-col gap-4 sm:flex-row sm:gap-10">
        <div>
          <p className="mb-1.5 text-xs uppercase opacity-60">{dict.ui.legendActivities}</p>
          <ul className="flex flex-col gap-1.5">
            {ACTIVITIES.map((a) => {
              const Icon = ACTIVITY_ICONS[a];
              return (
                <li key={a} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5">
                  <span className="mt-1 flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: ACTIVITY_COLORS[a] }}
                    />
                    <Icon className="shrink-0 text-lg" style={{ color: ACTIVITY_COLORS[a] }} />
                  </span>
                  <span>
                    <span className="font-medium">{translateEnum(dict, "activities", a)}</span>
                    <span className="block text-xs leading-relaxed opacity-70">{activityGuidance(dict, a)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-xs uppercase opacity-60">{dict.ui.legendEffects}</p>
          <ul className="flex flex-col gap-1.5">
            {EFFECTS.map((e) => (
              <li key={e}>
                <span className="font-medium">{translateEnum(dict, "effects", e)}</span>
                <span className="block text-xs leading-relaxed opacity-70">{effectGuidance(dict, e)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed opacity-60">{dict.guidance.disclaimer}</p>
    </details>
  );
}

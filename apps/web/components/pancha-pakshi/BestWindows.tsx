"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { ScheduleResponse, SubPeriod } from "@/lib/api-client";
import { BIRD_ICONS } from "@/components/icons/birds";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { ACTIVITY_COLORS } from "./activityColors";
import { activityGuidance } from "@/lib/pancha-guidance";

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EFFECT_RANK = { very_good: 0, good: 1 } as const;

// Top remaining good/very_good sub-periods of the displayed day. Pure
// selection over data already in the response — the multi-day equivalent
// lives server-side (the /windows endpoint used by the week view).
export function BestWindows({
  schedule,
  skewMs = 0,
  onSelect,
}: {
  schedule: ScheduleResponse;
  skewMs?: number;
  onSelect: (majorIndex: number) => void;
}) {
  const { dict, locale } = useLocale();
  // Ticked by effect (not read during render): a window that ends counts as
  // "past" within a minute without violating render purity.
  const [clientNow, setClientNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setClientNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const now = clientNow + skewMs;

  const candidates: SubPeriod[] = schedule.major_periods
    .flatMap((m) => m.sub_periods)
    .filter(
      (sp) =>
        (sp.effect === "very_good" || sp.effect === "good") &&
        new Date(sp.ends_at).getTime() > now,
    )
    .sort((a, b) => {
      const rank = EFFECT_RANK[a.effect as keyof typeof EFFECT_RANK] - EFFECT_RANK[b.effect as keyof typeof EFFECT_RANK];
      if (rank !== 0) return rank;
      if (a.rating !== b.rating) return b.rating - a.rating;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    })
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-4">
      <p className="text-xs font-semibold uppercase opacity-70">{dict.ui.bestWindowsToday}</p>
      {candidates.length === 0 ? (
        <p className="mt-2 text-sm opacity-70">{dict.ui.noWindowsLeft}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:gap-3">
          {candidates.map((sp) => {
            const BirdIcon = BIRD_ICONS[sp.sub_bird];
            const ActivityIcon = ACTIVITY_ICONS[sp.sub_activity];
            return (
              <li key={sp.id} className="sm:flex-1">
                <button
                  type="button"
                  onClick={() => onSelect(sp.major_index)}
                  className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-black/10 bg-background px-3 py-2.5 text-left text-sm hover:border-emerald-600/50 dark:border-white/10"
                >
                  <span className="min-w-0 flex-1 font-semibold tabular-nums">
                    {formatTime(sp.starts_at, locale)}–{formatTime(sp.ends_at, locale)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <BirdIcon className="text-lg opacity-90" />
                    <ActivityIcon
                      className="text-lg"
                      style={{ color: ACTIVITY_COLORS[sp.sub_activity] }}
                    />
                  </span>
                  <span className="text-xs opacity-70 sm:ml-auto">
                    {translateEnum(dict, "effects", sp.effect)}
                  </span>
                  <span
                    data-testid="best-window-guidance"
                    className="basis-full text-xs leading-relaxed opacity-70"
                  >
                    {activityGuidance(dict, sp.sub_activity)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

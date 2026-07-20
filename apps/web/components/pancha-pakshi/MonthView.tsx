"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import { fetchSummary, type ScheduleRequest, type SummaryResponse } from "@/lib/api-client";
import { EFFECT_COLORS } from "@fernandofamily/design-system";

// 31-day favourable-density heat-map via POST /summary. Same degradation
// contract as WeekView: any failure shows a friendly notice and the day
// views stay fully usable.
export function MonthView({
  request,
  onPickDay,
}: {
  request: ScheduleRequest; // the last day request; target_date = range start
  onPickDay: (date: string) => void;
}) {
  const { dict, locale } = useLocale();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;
    // Reset on request-identity change; the fetch is this effect's purpose.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    fetchSummary({ ...request, days: 31, min_effect: "good" })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  if (state === "loading") {
    return <p className="py-4 text-sm opacity-70">{dict.ui.monthLoading}</p>;
  }
  if (state === "unavailable" || !data) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        {dict.ui.monthUnavailable}
      </p>
    );
  }

  const todayIso = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  // Density scale: fraction of the sunrise-to-sunrise day that is favourable.
  // Steps rather than a continuous gradient so adjacent days are visually
  // comparable; the per-cell dot/label carries the same information without
  // relying on color alone.
  const maxSeconds = Math.max(1, ...data.per_day.map((d) => d.good_seconds + d.very_good_seconds));
  function tint(seconds: number): string {
    if (seconds === 0) return "transparent";
    const ratio = seconds / maxSeconds;
    if (ratio > 0.75) return `${EFFECT_COLORS.very_good}59`; // ~35% alpha
    if (ratio > 0.5) return `${EFFECT_COLORS.very_good}3d`; // ~24%
    if (ratio > 0.25) return `${EFFECT_COLORS.good}33`; // ~20%
    return `${EFFECT_COLORS.good}1f`; // ~12%
  }

  // Leading blanks so day cells align under their weekday column (weeks
  // start on Sunday, matching the locale's common convention).
  const firstDate = new Date(`${data.per_day[0].date}T12:00:00`);
  const leadingBlanks = firstDate.getDay();

  const weekdayFormatter = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", {
    weekday: "narrow",
  });
  const weekdayHeaders = Array.from({ length: 7 }, (_, i) =>
    // 2026-02-01 was a Sunday; any known Sunday anchors the sequence.
    weekdayFormatter.format(new Date(2026, 1, 1 + i)),
  );

  return (
    <div data-testid="month-grid" className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase opacity-70">
        {weekdayHeaders.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}
        {data.per_day.map((day) => {
          const dayNum = Number(day.date.slice(8));
          const seconds = day.good_seconds + day.very_good_seconds;
          const hours = seconds / 3600;
          const isToday = day.date === todayIso;
          const label = `${new Date(`${day.date}T12:00:00`).toLocaleDateString(
            locale === "si" ? "si-LK" : "en-US",
            { weekday: "short", month: "short", day: "numeric" },
          )} · ${day.window_count} ${dict.ui.monthWindows} · ${hours.toFixed(1)}h`;
          return (
            <button
              key={day.date}
              type="button"
              data-testid="month-day"
              title={label}
              aria-label={label}
              onClick={() => onPickDay(day.date)}
              style={{ backgroundColor: tint(seconds) }}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-sm hover:border-accent/60 ${
                isToday ? "border-accent font-bold" : "border-black/10 dark:border-white/10"
              }`}
            >
              <span className="tabular-nums">{dayNum}</span>
              {day.best_effect && (
                <span
                  className="text-[10px] leading-none opacity-80"
                  style={{ color: EFFECT_COLORS[day.best_effect] }}
                >
                  {day.window_count > 0 ? "●".repeat(Math.min(3, Math.ceil(day.window_count / 4))) : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs opacity-70">
        {dict.ui.monthLegend}: {translateEnum(dict, "effects", "good")} /{" "}
        {translateEnum(dict, "effects", "very_good")}
      </p>
    </div>
  );
}

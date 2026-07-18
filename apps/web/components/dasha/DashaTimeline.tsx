"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { MahadashaPeriod } from "@/lib/api-client";

function formatDate(date: string, locale: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// "Current" is decided client-side against the viewer's own local clock,
// not computed server-side -- the API response is a pure, deterministic
// list of periods for a given birth. Same clientNow-via-interval technique
// pancha-pakshi/BestWindows.tsx uses for its own "is this still open" check,
// just ticked much less often since these spans are years, not minutes.
export function DashaTimeline({ periods }: { periods: MahadashaPeriod[] }) {
  const { dict, locale } = useLocale();
  const [clientToday, setClientToday] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const interval = window.setInterval(() => setClientToday(new Date().toISOString().slice(0, 10)), 3_600_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <ul className="flex flex-col gap-2">
      {periods.map((period) => {
        const isCurrent = period.start_date <= clientToday && clientToday < period.end_date;
        return (
          <li
            key={`${period.key}-${period.start_date}`}
            data-testid="dasha-period"
            className={
              "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm " +
              (isCurrent
                ? "border-accent/60 bg-accent/10 ring-2 ring-accent"
                : "border-black/10 bg-white/30 dark:border-white/10 dark:bg-white/[.03]")
            }
          >
            <span className="min-w-[7rem] font-semibold">{translateEnum(dict, "horaPlanets", period.key)}</span>
            <span className="tabular-nums opacity-80">
              {formatDate(period.start_date, locale)} – {formatDate(period.end_date, locale)}
            </span>
            <span className="text-xs opacity-60">
              ({period.duration_years} {dict.dasha.durationYears})
            </span>
            {isCurrent && (
              <span className="ml-auto rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                {dict.dasha.currentLabel}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

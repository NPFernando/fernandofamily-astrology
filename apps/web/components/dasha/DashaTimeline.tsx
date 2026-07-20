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

function isCurrentPeriod(start: string, end: string, today: string) {
  return start <= today && today < end;
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

  // One row expanded at a time (MoonCalendarClient's single-selection
  // precedent), keyed by key-start_date. Auto-expand the current Mahadasha
  // -- the row a viewer almost always wants open -- while letting them
  // collapse it or open another (null = user explicitly collapsed).
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const current = periods.find((p) => isCurrentPeriod(p.start_date, p.end_date, today));
    return current ? `${current.key}-${current.start_date}` : null;
  });

  return (
    <ul className="flex flex-col gap-2">
      {periods.map((period) => {
        const rowId = `${period.key}-${period.start_date}`;
        const isCurrent = isCurrentPeriod(period.start_date, period.end_date, clientToday);
        const isExpanded = expandedId === rowId;
        return (
          <li key={rowId} data-testid="dasha-period">
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => setExpandedId(isExpanded ? null : rowId)}
              className={
                "flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-left text-sm " +
                (isCurrent
                  ? "border-accent/60 bg-accent/10 ring-2 ring-accent"
                  : "border-black/10 bg-white/30 hover:border-accent/40 dark:border-white/10 dark:bg-white/[.03]")
              }
            >
              <span className="min-w-[7rem] font-semibold">{translateEnum(dict, "horaPlanets", period.key)}</span>
              <span className="tabular-nums opacity-80">
                {formatDate(period.start_date, locale)} – {formatDate(period.end_date, locale)}
              </span>
              <span className="text-xs opacity-70">
                ({period.duration_years} {dict.dasha.durationYears})
              </span>
              {isCurrent && (
                <span className="ml-auto rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white">
                  {dict.dasha.currentLabel}
                </span>
              )}
              <span className={"text-xs opacity-40" + (isCurrent ? "" : " ml-auto")}>{isExpanded ? "▾" : "▸"}</span>
            </button>
            {isExpanded && (
              <div className="mt-1 ml-4 rounded-lg border border-black/10 bg-white/20 p-3 dark:border-white/10 dark:bg-white/[.02]">
                <p className="mb-2 text-xs font-semibold uppercase opacity-70">{dict.dasha.antardashaTitle}</p>
                <ul className="flex flex-col gap-1">
                  {period.antardashas.map((antara) => {
                    const antaraCurrent = isCurrentPeriod(antara.start_date, antara.end_date, clientToday);
                    return (
                      <li
                        key={`${antara.key}-${antara.start_date}`}
                        data-testid="dasha-antardasha"
                        className={
                          "flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded px-2 py-1.5 text-xs " +
                          (antaraCurrent ? "bg-accent/10 ring-1 ring-accent" : "")
                        }
                      >
                        <span className="min-w-[6rem] font-medium">
                          {translateEnum(dict, "horaPlanets", antara.key)}
                        </span>
                        <span className="tabular-nums opacity-70">
                          {formatDate(antara.start_date, locale)} – {formatDate(antara.end_date, locale)}
                        </span>
                        {antaraCurrent && (
                          <span className="ml-auto rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            {dict.dasha.currentLabel}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

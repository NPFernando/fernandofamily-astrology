"use client";

import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { NavamsaChart as NavamsaChartData } from "@/lib/api-client";

// Same 12-rashi order used throughout the backend (panchanga.repository.
// RASHI_KEYS): index 0 = Aries (mesha).
const RASHI_KEYS_0BASED = [
  "mesha",
  "vrishabha",
  "mithuna",
  "karka",
  "simha",
  "kanya",
  "tula",
  "vrischika",
  "dhanu",
  "makara",
  "kumbha",
  "meena",
];

// Fixed South Indian layout: rashi-to-cell mapping never changes per chart
// (unlike North Indian's diamond, which rotates per Ascendant) — only which
// grahas/Lagna land in each cell changes. Standard convention, reading
// clockwise from top-left starting at Pisces. `null` = the unused center.
const GRID_LAYOUT: (number | null)[][] = [
  [11, 0, 1, 2],
  [10, null, null, 3],
  [9, null, null, 4],
  [8, 7, 6, 5],
];

export function NavamsaChart({ chart }: { chart: NavamsaChartData }) {
  const { dict } = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <div className="grid aspect-square max-w-md grid-cols-4 grid-rows-4 gap-1 rounded-xl border border-black/10 bg-white/30 p-1 dark:border-white/10 dark:bg-white/[.03]">
        {GRID_LAYOUT.flatMap((row, rowIndex) =>
          row.map((cellRashi0Based, colIndex) => {
            const key = `${rowIndex}-${colIndex}`;
            if (cellRashi0Based === null) {
              return <div key={key} className="rounded-lg" aria-hidden="true" />;
            }
            const rashiKey = RASHI_KEYS_0BASED[cellRashi0Based];
            const grahasHere = chart.placements.filter((p) => p.rashi_key === rashiKey);
            const isAscendant = chart.ascendant_rashi_key === rashiKey;
            return (
              <div
                key={key}
                data-testid={`navamsa-cell-${rashiKey}`}
                className="flex flex-col gap-1 rounded-lg border border-black/10 p-1.5 text-xs dark:border-white/10"
              >
                <span className="font-medium opacity-70">{translateEnum(dict, "rashis", rashiKey)}</span>
                <div className="flex flex-wrap gap-1">
                  {isAscendant && (
                    <span className="rounded bg-accent/20 px-1 font-semibold text-accent">
                      {dict.divisionalCharts.ascendant}
                    </span>
                  )}
                  {grahasHere.map((p) => (
                    <span key={p.key} className="rounded bg-black/5 px-1 dark:bg-white/10">
                      {translateEnum(dict, "horaPlanets", p.key)}
                    </span>
                  ))}
                </div>
              </div>
            );
          }),
        )}
      </div>
      <p className="text-xs opacity-70">{dict.divisionalCharts.layoutNote}</p>
    </div>
  );
}

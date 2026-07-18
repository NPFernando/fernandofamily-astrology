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

// North Indian layout: house-to-cell position is fixed (house 1/Lagna is
// always the top diamond) — unlike South Indian's fixed rashi-to-cell grid,
// here it's the *rashi occupying each house* that rotates with the
// Ascendant, matching Sri Lankan kendaraya convention. Geometry is on a
// 0-100 percentage coordinate system: 4 "kite" houses at the cardinal
// midpoints (1/4/7/10) and 8 triangular houses in the corners, following
// the classical diamond-plus-diagonals construction.
type HouseCell = { house: number; points: string; labelX: number; labelY: number };

const HOUSE_CELLS: HouseCell[] = [
  { house: 1, points: "50,0 75,25 50,50 25,25", labelX: 50, labelY: 25 },
  { house: 2, points: "0,0 50,0 25,25", labelX: 25, labelY: 8.33 },
  { house: 3, points: "0,0 25,25 0,50", labelX: 8.33, labelY: 25 },
  { house: 4, points: "0,50 25,25 50,50 25,75", labelX: 25, labelY: 50 },
  { house: 5, points: "0,50 25,75 0,100", labelX: 8.33, labelY: 75 },
  { house: 6, points: "0,100 25,75 50,100", labelX: 25, labelY: 91.67 },
  { house: 7, points: "50,100 25,75 50,50 75,75", labelX: 50, labelY: 75 },
  { house: 8, points: "50,100 75,75 100,100", labelX: 75, labelY: 91.67 },
  { house: 9, points: "100,100 75,75 100,50", labelX: 91.67, labelY: 75 },
  { house: 10, points: "100,50 75,75 50,50 75,25", labelX: 75, labelY: 50 },
  { house: 11, points: "100,50 75,25 100,0", labelX: 91.67, labelY: 25 },
  { house: 12, points: "100,0 75,25 50,0", labelX: 75, labelY: 8.33 },
];

// House 1 always carries the Ascendant's rashi; house N carries the rashi
// (N-1) positions ahead of it in the 12-rashi cycle.
function rashiIndex0BasedForHouse(ascendantRashiIndex1Based: number, house: number): number {
  return (ascendantRashiIndex1Based - 1 + (house - 1)) % 12;
}

export function NavamsaChart({ chart }: { chart: NavamsaChartData }) {
  const { dict } = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square max-w-md rounded-xl border border-black/10 bg-white/30 dark:border-white/10 dark:bg-white/[.03]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <g className="stroke-black/10 dark:stroke-white/10" fill="none" strokeWidth="0.5">
            <rect x="0" y="0" width="100" height="100" />
            <path d="M0,0 L100,100 M100,0 L0,100" />
            <path d="M50,0 L100,50 L50,100 L0,50 Z" />
          </g>
        </svg>
        {HOUSE_CELLS.map(({ house, labelX, labelY }) => {
          const rashiKey = RASHI_KEYS_0BASED[rashiIndex0BasedForHouse(chart.ascendant_rashi_index, house)];
          const grahasHere = chart.placements.filter((p) => p.rashi_key === rashiKey);
          const isAscendant = chart.ascendant_rashi_key === rashiKey;
          return (
            <div
              key={house}
              data-testid={`navamsa-cell-${rashiKey}`}
              className="absolute flex max-w-[30%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-center text-[10px] leading-tight sm:text-xs"
              style={{ left: `${labelX}%`, top: `${labelY}%` }}
            >
              <span className="font-medium opacity-70">{translateEnum(dict, "rashis", rashiKey)}</span>
              <div className="flex flex-wrap justify-center gap-0.5">
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
        })}
      </div>
      <p className="text-xs opacity-70">{dict.divisionalCharts.layoutNote}</p>
    </div>
  );
}

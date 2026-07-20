"use client";

import { useLocale } from "@/lib/locale-context";
import { RasiStyleChart } from "@/components/charts/RasiStyleChart";
import type { BirthChart as BirthChartData } from "@/lib/api-client";
import { YOGATARA_STAR_LABELS } from "@/lib/yogatara-stars";

export function BirthChartChart({ chart, showStars = false }: { chart: BirthChartData; showStars?: boolean }) {
  const { dict } = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <RasiStyleChart
        chart={chart}
        ascendantLabel={dict.birthChart.ascendant}
        testIdPrefix="rasi"
        showHouseNumbers
        showDegrees
        overlays={
          showStars
            ? chart.yogataras.map((y) => ({
                key: y.nakshatra_key,
                rashi_key: y.rashi_key,
                degrees: y.degrees,
                label: YOGATARA_STAR_LABELS[y.nakshatra_key] ?? y.nakshatra_key,
              }))
            : undefined
        }
      />
      <p className="text-xs opacity-70">{dict.birthChart.layoutNote}</p>
    </div>
  );
}

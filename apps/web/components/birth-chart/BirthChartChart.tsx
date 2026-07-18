"use client";

import { useLocale } from "@/lib/locale-context";
import { RasiStyleChart } from "@/components/charts/RasiStyleChart";
import type { BirthChart as BirthChartData } from "@/lib/api-client";

export function BirthChartChart({ chart }: { chart: BirthChartData }) {
  const { dict } = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <RasiStyleChart
        chart={chart}
        ascendantLabel={dict.birthChart.ascendant}
        testIdPrefix="rasi"
        showHouseNumbers
      />
      <p className="text-xs opacity-70">{dict.birthChart.layoutNote}</p>
    </div>
  );
}

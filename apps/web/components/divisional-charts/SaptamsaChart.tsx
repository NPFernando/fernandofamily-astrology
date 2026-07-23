"use client";

import { useLocale } from "@/lib/locale-context";
import { RasiStyleChart } from "@/components/charts/RasiStyleChart";
import type { SaptamsaChart as SaptamsaChartData } from "@/lib/api-client";

export function SaptamsaChart({ chart }: { chart: SaptamsaChartData }) {
  const { dict } = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <RasiStyleChart chart={chart} ascendantLabel={dict.divisionalCharts.ascendant} testIdPrefix="saptamsa" />
      <p className="text-xs opacity-70">{dict.divisionalCharts.layoutNote}</p>
    </div>
  );
}

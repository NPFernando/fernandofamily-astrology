"use client";

import { useLocale } from "@/lib/locale-context";
import { RasiStyleChart } from "@/components/charts/RasiStyleChart";
import type { DasamsaChart as DasamsaChartData } from "@/lib/api-client";

export function DasamsaChart({ chart }: { chart: DasamsaChartData }) {
  const { dict } = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <RasiStyleChart chart={chart} ascendantLabel={dict.divisionalCharts.ascendant} testIdPrefix="dasamsa" />
      <p className="text-xs opacity-70">{dict.divisionalCharts.layoutNote}</p>
    </div>
  );
}

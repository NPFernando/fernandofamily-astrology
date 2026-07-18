"use client";

import { useLocale } from "@/lib/locale-context";
import { RasiStyleChart } from "@/components/charts/RasiStyleChart";
import type { NavamsaChart as NavamsaChartData } from "@/lib/api-client";

export function NavamsaChart({ chart }: { chart: NavamsaChartData }) {
  const { dict } = useLocale();

  return (
    <div className="flex flex-col gap-3">
      <RasiStyleChart chart={chart} ascendantLabel={dict.divisionalCharts.ascendant} testIdPrefix="navamsa" />
      <p className="text-xs opacity-70">{dict.divisionalCharts.layoutNote}</p>
    </div>
  );
}

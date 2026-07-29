"use client";

import { translateEnum } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";
import type { AshtakavargaResult } from "@/lib/api-client";

export function AshtakavargaInsights({ result }: { result: AshtakavargaResult }) {
  const { dict } = useLocale();
  const ordered = [...result.sarvashtakavarga].sort((a, b) => b.points - a.points);
  const strongest = ordered.slice(0, 3); const weakest = ordered.slice(-3).reverse();
  const average = result.total_points / result.sarvashtakavarga.length;
  return <section className="mt-5 rounded-xl bg-accent/10 p-4"><h3 className="font-semibold text-accent">{dict.ashtakavarga.interpretationTitle}</h3><p className="mt-1 text-sm opacity-80">{dict.ashtakavarga.interpretationIntro.replace("{average}", average.toFixed(1))}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><h4 className="text-sm font-semibold">{dict.ashtakavarga.strongerRashis}</h4><p className="mt-1 text-sm">{strongest.map((house) => `${translateEnum(dict, "rashis", house.rashi_key)} (${house.points})`).join(" · ")}</p></div><div><h4 className="text-sm font-semibold">{dict.ashtakavarga.gentlerRashis}</h4><p className="mt-1 text-sm">{weakest.map((house) => `${translateEnum(dict, "rashis", house.rashi_key)} (${house.points})`).join(" · ")}</p></div></div><p className="mt-3 text-xs opacity-75">{dict.ashtakavarga.interpretationNote}</p></section>;
}

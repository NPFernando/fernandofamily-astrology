"use client";

import { useLocale } from "@/lib/locale-context";
import { NAKSHATRAS, translateEnum } from "@/lib/i18n";
import type { GrahaYogatara } from "@/lib/api-client";
import { YOGATARA_STAR_LABELS } from "@/lib/yogatara-stars";

// Same rounding-carry convention as RasiStyleChart's formatDegreeMinutes —
// duplicated per the codebase's per-component-helper convention.
function formatSeparation(deg: number): string {
  let degrees = Math.floor(deg);
  let minutes = Math.round((deg - degrees) * 60);
  if (minutes === 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${degrees}°${String(minutes).padStart(2, "0")}′`;
}

function nakshatraNameByKey(key: string, locale: "en" | "si"): string {
  const entry = NAKSHATRAS.find((n) => n.key === key);
  if (!entry) return key;
  return locale === "si" ? entry.si : entry.en;
}

export function YogataraTable({ rows }: { rows: GrahaYogatara[] }) {
  const { dict, locale } = useLocale();

  return (
    <div className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
        {dict.birthChart.yogataraTitle}
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 text-xs uppercase tracking-wide opacity-60 dark:border-white/10">
              <th className="py-1.5 pr-3 font-semibold">{dict.birthChart.yogataraGrahaHeader}</th>
              <th className="py-1.5 pr-3 font-semibold">{dict.birthChart.yogataraNakshatraHeader}</th>
              <th className="py-1.5 pr-3 font-semibold">{dict.birthChart.yogataraStarHeader}</th>
              <th className="py-1.5 font-semibold">{dict.birthChart.yogataraSeparationHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                data-testid={`yogatara-row-${row.key}`}
                className="border-b border-black/5 last:border-0 dark:border-white/5"
              >
                <td className="py-1.5 pr-3 font-medium">{translateEnum(dict, "horaPlanets", row.key)}</td>
                <td className="py-1.5 pr-3">{nakshatraNameByKey(row.nakshatra_key, locale)}</td>
                <td className="py-1.5 pr-3 italic">{YOGATARA_STAR_LABELS[row.nakshatra_key] ?? row.nakshatra_key}</td>
                <td className="py-1.5">{formatSeparation(row.separation_degrees)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed opacity-70">{dict.birthChart.yogataraNote}</p>
    </div>
  );
}

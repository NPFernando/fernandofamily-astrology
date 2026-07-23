"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";

// Same 12-rashi order / house-rotation formula as RasiStyleChart.tsx —
// duplicated rather than imported since the two components render very
// different things (SVG diamond vs. a plain print table) from the same
// underlying data; see sinhalaMonthName() elsewhere in the codebase for the
// established precedent of duplicating a small pure helper per component
// instead of sharing it.
const RASHI_KEYS_0BASED = [
  "mesha", "vrishabha", "mithuna", "karka", "simha", "kanya",
  "tula", "vrischika", "dhanu", "makara", "kumbha", "meena",
];

function rashiIndex0BasedForHouse(ascendantRashiIndex1Based: number, house: number): number {
  return (ascendantRashiIndex1Based - 1 + (house - 1)) % 12;
}

function formatDegreeMinutes(deg: number): string {
  let degrees = Math.floor(deg);
  let minutes = Math.round((deg - degrees) * 60);
  if (minutes === 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${degrees}°${String(minutes).padStart(2, "0")}′`;
}

export type ChartPrintData = {
  ascendant_rashi_index: number;
  ascendant_degrees?: number;
  placements: { key: string; rashi_key: string; degrees?: number }[];
};

// Print-only house-by-house table for any RasiStyleChartData-shaped chart
// (Birth Chart D1, Navamsa D9) — same hidden-node + @media print mechanism
// as pancha-pakshi/PrintSheet.tsx. A table rather than a redrawn diamond:
// print is about a portable, legible record, not visually replicating the
// on-screen SVG.
export function ChartPrintSheet({
  title,
  subtitle,
  chart,
  ascendantLabel,
  showDegrees = false,
  extra,
}: {
  title: string;
  subtitle: string;
  chart: ChartPrintData;
  ascendantLabel: string;
  showDegrees?: boolean;
  extra?: React.ReactNode;
}) {
  const { dict, locale } = useLocale();

  useEffect(() => {
    document.body.classList.add("has-print-sheet");
    return () => document.body.classList.remove("has-print-sheet");
  }, []);

  const rows = Array.from({ length: 12 }, (_, i) => i + 1).map((house) => {
    const rashiKey = RASHI_KEYS_0BASED[rashiIndex0BasedForHouse(chart.ascendant_rashi_index, house)];
    const occupants = chart.placements.filter((p) => p.rashi_key === rashiKey);
    const isAscendant = house === 1;
    return { house, rashiKey, occupants, isAscendant };
  });

  return (
    <div id="print-sheet" aria-hidden className="hidden print:block">
      <header style={{ borderBottom: "2px solid #333", paddingBottom: "8px", marginBottom: "12px" }}>
        <h1 style={{ fontSize: "18pt", fontWeight: 700, margin: 0 }}>
          {dict.platform.name} — {title}
        </h1>
        <p style={{ fontSize: "11pt", margin: "4px 0 0" }}>{subtitle}</p>
      </header>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10pt" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #333", textAlign: "left" }}>
            <th style={{ padding: "3px 6px" }}>{dict.ui.house}</th>
            <th style={{ padding: "3px 6px" }}>{dict.ui.rashi}</th>
            <th style={{ padding: "3px 6px" }}>{dict.ui.occupants}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ house, rashiKey, occupants, isAscendant }) => (
            <tr key={house} style={{ borderBottom: "0.5px solid #bbb" }} className="print-avoid-break">
              <td style={{ padding: "3px 6px" }}>{house}</td>
              <td style={{ padding: "3px 6px" }}>{translateEnum(dict, "rashis", rashiKey)}</td>
              <td style={{ padding: "3px 6px" }}>
                {[
                  isAscendant
                    ? `${ascendantLabel}${
                        showDegrees && chart.ascendant_degrees !== undefined
                          ? ` (${formatDegreeMinutes(chart.ascendant_degrees)})`
                          : ""
                      }`
                    : null,
                  ...occupants.map(
                    (p) =>
                      `${translateEnum(dict, "horaPlanets", p.key)}${
                        showDegrees && p.degrees !== undefined ? ` (${formatDegreeMinutes(p.degrees)})` : ""
                      }`,
                  ),
                ]
                  .filter((v): v is string => v !== null)
                  .join(", ") || dict.ui.none}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {extra}

      <footer style={{ marginTop: "12px", borderTop: "1px solid #999", paddingTop: "6px" }}>
        <p style={{ fontSize: "8pt", color: "#555", margin: 0 }}>
          {dict.ui.generatedAt}: {new Date().toLocaleString(locale === "si" ? "si-LK" : "en-US")} ·
          astrology.fernandofamily.com
        </p>
        <p style={{ fontSize: "7.5pt", color: "#666", margin: "4px 0 0" }}>{dict.disclaimer.text}</p>
      </footer>
    </div>
  );
}

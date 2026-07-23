"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { MahadashaPeriod } from "@/lib/api-client";

function fmtDate(iso: string, locale: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Same hidden-node + @media print mechanism as pancha-pakshi/PrintSheet.tsx
// and ChartPrintSheet.tsx.
export function DashaPrintSheet({
  periods,
  birthDate,
  birthTime,
  locationName,
}: {
  periods: MahadashaPeriod[];
  birthDate: string;
  birthTime: string;
  locationName: string;
}) {
  const { dict, locale } = useLocale();

  useEffect(() => {
    document.body.classList.add("has-print-sheet");
    return () => document.body.classList.remove("has-print-sheet");
  }, []);

  return (
    <div id="print-sheet" aria-hidden className="hidden print:block">
      <header style={{ borderBottom: "2px solid #333", paddingBottom: "8px", marginBottom: "12px" }}>
        <h1 style={{ fontSize: "18pt", fontWeight: 700, margin: 0 }}>
          {dict.platform.name} — {dict.dasha.resultTitle}
        </h1>
        <p style={{ fontSize: "11pt", margin: "4px 0 0" }}>
          {fmtDate(birthDate, locale)} {birthTime.slice(0, 5)} · {locationName}
        </p>
      </header>

      {periods.map((mahadasha) => (
        <section key={mahadasha.key} style={{ marginBottom: "8px" }} className="print-avoid-break">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
            <tbody>
              <tr style={{ background: "#f0f0f0", borderTop: "1.5px solid #333" }}>
                <td style={{ padding: "4px 6px", fontWeight: 700 }} colSpan={2}>
                  {translateEnum(dict, "horaPlanets", mahadasha.key)} — {mahadasha.duration_years}{" "}
                  {dict.dasha.durationYears}
                </td>
                <td style={{ padding: "4px 6px", fontWeight: 700 }}>{fmtDate(mahadasha.start_date, locale)}</td>
                <td style={{ padding: "4px 6px", fontWeight: 700 }}>{fmtDate(mahadasha.end_date, locale)}</td>
              </tr>
              {mahadasha.antardashas.map((antardasha, i) => (
                <tr key={i} style={{ borderBottom: "0.5px solid #ccc" }}>
                  <td style={{ padding: "2px 6px", paddingLeft: "18px" }} colSpan={2}>
                    {translateEnum(dict, "horaPlanets", antardasha.key)}
                  </td>
                  <td style={{ padding: "2px 6px" }}>{fmtDate(antardasha.start_date, locale)}</td>
                  <td style={{ padding: "2px 6px" }}>{fmtDate(antardasha.end_date, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

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

"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { MajorPeriod, ScheduleResponse } from "@/lib/api-client";
import { ACTIVITY_COLORS } from "./activityColors";
import { BIRD_ICONS } from "@/components/icons/birds";

export type ExportDetail = "full" | "major";

function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// The document that actually prints: invisible on screen, the ONLY visible
// content under @media print (see globals.css). Renders purely from the
// already-fetched schedule — printing never refetches.
export function PrintSheet({
  schedule,
  detail,
}: {
  schedule: ScheduleResponse;
  detail: ExportDetail;
}) {
  const { dict, locale } = useLocale();
  const BirdIcon = BIRD_ICONS[schedule.birth_bird];

  // Marks the document so the global @media print rules know a dedicated
  // print sheet exists on this page (pages without one print their own
  // content instead of a blank page — see globals.css).
  useEffect(() => {
    document.body.classList.add("has-print-sheet");
    return () => document.body.classList.remove("has-print-sheet");
  }, []);

  const dayPeriods = schedule.major_periods.filter((p) => p.kind === "day");
  const nightPeriods = schedule.major_periods.filter((p) => p.kind === "night");

  return (
    <div id="print-sheet" aria-hidden className="hidden print:block">
      <header style={{ borderBottom: "2px solid #333", paddingBottom: "8px", marginBottom: "12px" }}>
        <h1 style={{ fontSize: "18pt", fontWeight: 700, margin: 0 }}>
          {dict.platform.name} — {dict.features.panchaPakshi.title}
        </h1>
        <p style={{ fontSize: "11pt", margin: "4px 0 0" }}>
          <BirdIcon style={{ verticalAlign: "-2px" }} /> {translateEnum(dict, "birds", schedule.birth_bird)} ·{" "}
          {fmtDate(schedule.sunrise, locale)} · {schedule.location.name}
        </p>
        <p style={{ fontSize: "9pt", margin: "4px 0 0", color: "#444" }}>
          {dict.ui.sunrise} {fmtTime(schedule.sunrise, locale)} · {dict.ui.sunset}{" "}
          {fmtTime(schedule.sunset, locale)} · {dict.ui.nextSunrise} {fmtTime(schedule.next_sunrise, locale)} ·{" "}
          {translateEnum(dict, "paksha", schedule.paksha)} · {dict.ui.paduPakshi}:{" "}
          {translateEnum(dict, "birds", schedule.padu_pakshi)}
        </p>
      </header>

      <PrintSection title={dict.ui.daytime} periods={dayPeriods} detail={detail} locale={locale} />
      <PrintSection title={dict.ui.nighttime} periods={nightPeriods} detail={detail} locale={locale} />

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

function PrintSection({
  title,
  periods,
  detail,
  locale,
}: {
  title: string;
  periods: MajorPeriod[];
  detail: ExportDetail;
  locale: string;
}) {
  const { dict } = useLocale();
  return (
    <section style={{ marginBottom: "10px" }}>
      <h2 style={{ fontSize: "12pt", fontWeight: 700, margin: "8px 0 4px" }}>{title}</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
        <thead>
          <tr style={{ borderBottom: "1.5px solid #333", textAlign: "left" }}>
            <th style={{ padding: "3px 6px" }}>{dict.ui.startsAt}</th>
            <th style={{ padding: "3px 6px" }}>{dict.ui.endsAt}</th>
            <th style={{ padding: "3px 6px" }}>
              {detail === "major" ? dict.ui.mainActivity : dict.ui.mainBird}
            </th>
            {detail === "full" && (
              <>
                <th style={{ padding: "3px 6px" }}>{dict.ui.subBird}</th>
                <th style={{ padding: "3px 6px" }}>{dict.ui.subActivity}</th>
                <th style={{ padding: "3px 6px" }}>{dict.ui.relation}</th>
                <th style={{ padding: "3px 6px" }}>{dict.ui.effect}</th>
                <th style={{ padding: "3px 6px" }}>{dict.ui.rating}</th>
              </>
            )}
            {detail === "major" && <th style={{ padding: "3px 6px" }}>{dict.ui.bharanaPakshi}</th>}
          </tr>
        </thead>
        <tbody>
          {periods.map((mp) =>
            detail === "major" ? (
              <tr key={mp.index} style={{ borderBottom: "0.5px solid #bbb" }} className="print-avoid-break">
                <td style={{ padding: "3px 6px" }}>{fmtTime(mp.starts_at, locale)}</td>
                <td style={{ padding: "3px 6px" }}>{fmtTime(mp.ends_at, locale)}</td>
                <td style={{ padding: "3px 6px" }}>
                  <Swatch color={ACTIVITY_COLORS[mp.main_activity]} />
                  {translateEnum(dict, "activities", mp.main_activity)}
                </td>
                <td style={{ padding: "3px 6px" }}>{translateEnum(dict, "birds", mp.bharana_pakshi)}</td>
              </tr>
            ) : (
              <PrintMajorGroup key={mp.index} period={mp} locale={locale} />
            ),
          )}
        </tbody>
      </table>
    </section>
  );
}

function PrintMajorGroup({ period, locale }: { period: MajorPeriod; locale: string }) {
  const { dict } = useLocale();
  return (
    <>
      <tr style={{ borderTop: "1.5px solid #333", background: "#f0f0f0" }} className="print-avoid-break">
        <td style={{ padding: "3px 6px", fontWeight: 700 }}>{fmtTime(period.starts_at, locale)}</td>
        <td style={{ padding: "3px 6px", fontWeight: 700 }}>{fmtTime(period.ends_at, locale)}</td>
        <td style={{ padding: "3px 6px", fontWeight: 700 }} colSpan={6}>
          <Swatch color={ACTIVITY_COLORS[period.main_activity]} />
          {translateEnum(dict, "birds", period.main_bird)} —{" "}
          {translateEnum(dict, "activities", period.main_activity)}
        </td>
      </tr>
      {period.sub_periods.map((sp) => (
        <tr key={sp.id} style={{ borderBottom: "0.5px solid #ccc" }}>
          <td style={{ padding: "2px 6px" }}>{fmtTime(sp.starts_at, locale)}</td>
          <td style={{ padding: "2px 6px" }}>{fmtTime(sp.ends_at, locale)}</td>
          <td style={{ padding: "2px 6px" }} />
          <td style={{ padding: "2px 6px" }}>{translateEnum(dict, "birds", sp.sub_bird)}</td>
          <td style={{ padding: "2px 6px" }}>
            <Swatch color={ACTIVITY_COLORS[sp.sub_activity]} />
            {translateEnum(dict, "activities", sp.sub_activity)}
          </td>
          <td style={{ padding: "2px 6px" }}>{translateEnum(dict, "relations", sp.relation)}</td>
          <td style={{ padding: "2px 6px" }}>{translateEnum(dict, "effects", sp.effect)}</td>
          <td style={{ padding: "2px 6px" }}>{sp.rating}</td>
        </tr>
      ))}
    </>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "8pt",
        height: "8pt",
        borderRadius: "2pt",
        background: color,
        marginRight: "4pt",
        verticalAlign: "-1pt",
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    />
  );
}

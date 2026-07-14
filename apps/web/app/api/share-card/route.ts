import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import en from "@/locales/en.json";
import si from "@/locales/si.json";
import { ACTIVITY_COLORS } from "@fernandofamily/design-system";

// Server-rendered PNG of a day's schedule for sharing (WhatsApp/social).
// POST-only like every schedule-carrying route (no location data in URLs);
// the schedule is recomputed server-side from the request body via FastAPI,
// so the card always reflects real engine output, never client state.

const DETAILS = ["major", "full"] as const;
const LOCALES = ["en", "si"] as const;

type Detail = (typeof DETAILS)[number];
type Locale = (typeof LOCALES)[number];

const DICTS = { en, si } as const;

type SubPeriod = {
  starts_at: string;
  ends_at: string;
  sub_bird: string;
  sub_activity: string;
  effect: string;
};

type MajorPeriod = {
  kind: "day" | "night";
  starts_at: string;
  ends_at: string;
  main_bird: string;
  main_activity: string;
  sub_periods: SubPeriod[];
};

type Schedule = {
  birth_bird: string;
  sunrise: string;
  sunset: string;
  next_sunrise: string;
  location: { name: string; iana_tz: string };
  major_periods: MajorPeriod[];
};

// All interpolated text lands inside an XML document — location names are
// user input and must never be able to break out of their text node.
function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// timeZone is load-bearing: this runs server-side where the process
// timezone (UTC in the container) differs from the schedule's location —
// without it every printed time silently shifts by the UTC offset.
function fmtTime(iso: string, locale: Locale, tz: string): string {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

function fmtDate(iso: string, locale: Locale, tz: string): string {
  return new Date(iso).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: tz,
  });
}

const BRAND_MARK_DATA_URI = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public/icons/app/icon-512.png"),
).toString("base64")}`;

const FONT = "Noto Sans, Noto Sans Sinhala, DejaVu Sans, sans-serif";
const FONT_SI = "Noto Sans Sinhala, Noto Sans, sans-serif";

function translate(dict: typeof en, group: "birds" | "activities", key: string): string {
  const table = dict.enums[group] as Record<string, string>;
  return table[key] ?? key;
}

function buildSvg(schedule: Schedule, detail: Detail, locale: Locale): string {
  const dict = DICTS[locale];
  const tz = schedule.location.iana_tz;
  const W = 1200;
  const H = 630;

  const dateLine = fmtDate(schedule.sunrise, locale, tz);
  const birdLine = translate(dict, "birds", schedule.birth_bird);
  const locationLine = schedule.location.name;

  // Proportional major-period bar, sunrise -> next sunrise.
  const t0 = new Date(schedule.sunrise).getTime();
  const t1 = new Date(schedule.next_sunrise).getTime();
  const barX = 80;
  const barW = W - 160;
  const barY = 300;
  const barH = 46;
  const segments = schedule.major_periods
    .map((mp) => {
      const x = barX + ((new Date(mp.starts_at).getTime() - t0) / (t1 - t0)) * barW;
      const w = ((new Date(mp.ends_at).getTime() - new Date(mp.starts_at).getTime()) / (t1 - t0)) * barW;
      const color = ACTIVITY_COLORS[mp.main_activity as keyof typeof ACTIVITY_COLORS] ?? "#888";
      const opacity = mp.kind === "day" ? "0.95" : "0.65";
      return `<rect x="${x.toFixed(1)}" y="${barY}" width="${Math.max(w - 2, 1).toFixed(1)}" height="${barH}" rx="4" fill="${color}" opacity="${opacity}"/>`;
    })
    .join("\n");

  // Legend under the bar: sunrise / sunset / next sunrise markers.
  const sunsetX = barX + ((new Date(schedule.sunset).getTime() - t0) / (t1 - t0)) * barW;
  const markers = `
    <text x="${barX}" y="${barY + barH + 30}" font-family="${FONT}" font-size="20" fill="rgba(255,255,255,0.85)">☀ ${fmtTime(schedule.sunrise, locale, tz)}</text>
    <text x="${sunsetX.toFixed(1)}" y="${barY + barH + 30}" text-anchor="middle" font-family="${FONT}" font-size="20" fill="rgba(255,255,255,0.85)">☾ ${fmtTime(schedule.sunset, locale, tz)}</text>
    <text x="${barX + barW}" y="${barY + barH + 30}" text-anchor="end" font-family="${FONT}" font-size="20" fill="rgba(255,255,255,0.85)">☀ ${fmtTime(schedule.next_sunrise, locale, tz)}</text>`;

  // Detail block: major mode lists the major periods' activities; full mode
  // shows the top favourable sub-period windows instead (50 rows can't fit —
  // the "best times" summary is the useful shareable detail).
  let detailBlock = "";
  if (detail === "major") {
    const dayList = schedule.major_periods.filter((m) => m.kind === "day");
    const nightList = schedule.major_periods.filter((m) => m.kind === "night");
    const col = (items: MajorPeriod[], x: number, title: string) => {
      const rows = items
        .map((mp, i) => {
          const color = ACTIVITY_COLORS[mp.main_activity as keyof typeof ACTIVITY_COLORS] ?? "#888";
          const label = `${fmtTime(mp.starts_at, locale, tz)} ${esc(translate(dict, "activities", mp.main_activity))}`;
          return `<circle cx="${x}" cy="${430 + i * 34}" r="7" fill="${color}"/>
            <text x="${x + 18}" y="${436 + i * 34}" font-family="${FONT}" font-size="21" fill="#ffffff">${label}</text>`;
        })
        .join("\n");
      return `<text x="${x}" y="${400}" font-family="${FONT}" font-size="19" font-weight="700" fill="rgba(255,255,255,0.7)">${esc(title)}</text>${rows}`;
    };
    detailBlock = col(dayList, barX, dict.ui.daytime) + col(nightList, W / 2 + 40, dict.ui.nighttime);
  } else {
    const best = schedule.major_periods
      .flatMap((mp) => mp.sub_periods)
      .filter((sp) => sp.effect === "very_good" || sp.effect === "good")
      .sort((a, b) => (a.effect === b.effect ? 0 : a.effect === "very_good" ? -1 : 1))
      .slice(0, 4);
    const rows = best
      .map((sp, i) => {
        const label = `${fmtTime(sp.starts_at, locale, tz)}–${fmtTime(sp.ends_at, locale, tz)}  ${esc(
          translate(dict, "birds", sp.sub_bird),
        )} · ${esc(translate(dict, "activities", sp.sub_activity))}`;
        const star = sp.effect === "very_good" ? "★★" : "★";
        return `<text x="${barX}" y="${436 + i * 36}" font-family="${FONT}" font-size="22" fill="#ffffff">${star} ${label}</text>`;
      })
      .join("\n");
    detailBlock = `<text x="${barX}" y="400" font-family="${FONT_SI}" font-size="19" font-weight="700" fill="rgba(255,255,255,0.7)">${esc(
      dict.ui.bestWindowsToday,
    )}</text>${rows}`;
  }

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="dawn" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#1e1b4b"/>
      <stop offset="0.4" stop-color="#4c1d95"/>
      <stop offset="0.78" stop-color="#b45309"/>
      <stop offset="1" stop-color="#f5b942"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#dawn)"/>
  <image href="${BRAND_MARK_DATA_URI}" x="${W - 210}" y="38" width="144" height="144" preserveAspectRatio="xMidYMid meet"/>
  <text x="${barX}" y="80" font-family="${FONT}" font-size="30" font-weight="700" fill="rgba(255,255,255,0.92)">Fernando Family Astrology · <tspan font-family="${FONT_SI}">ජ්‍යෝතිෂ</tspan></text>
  <text x="${barX}" y="150" font-family="${FONT_SI}" font-size="44" font-weight="700" fill="#ffffff">${esc(birdLine)} — ${esc(dateLine)}</text>
  <text x="${barX}" y="195" font-family="${FONT_SI}" font-size="26" fill="rgba(255,255,255,0.85)">${esc(locationLine)}</text>
  <text x="${barX}" y="252" font-family="${FONT_SI}" font-size="22" fill="rgba(255,255,255,0.7)">${esc(dict.features.panchaPakshi.title)}</text>
  ${segments}
  ${markers}
  ${detailBlock}
  <text x="${W - 80}" y="${H - 30}" text-anchor="end" font-family="${FONT}" font-size="18" fill="rgba(255,255,255,0.6)">astrology.fernandofamily.com</text>
</svg>`;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const detail = (body.detail ?? "full") as string;
  const locale = (body.locale ?? "si") as string;
  if (!DETAILS.includes(detail as Detail)) {
    return NextResponse.json({ error: "invalid_detail" }, { status: 422 });
  }
  if (!LOCALES.includes(locale as Locale)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 422 });
  }

  // Everything else in the body is the schedule request — forwarded as-is;
  // FastAPI is the validator of record for it. Never logged.
  const scheduleRequest = { ...body };
  delete scheduleRequest.detail;
  delete scheduleRequest.locale;

  const apiBase = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8100";
  let scheduleRes: Response;
  try {
    scheduleRes = await fetch(`${apiBase}/api/v1/pancha-pakshi/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scheduleRequest),
    });
  } catch {
    return NextResponse.json({ error: "engine_unreachable" }, { status: 503 });
  }
  if (!scheduleRes.ok) {
    return NextResponse.json({ error: "invalid_schedule_request" }, { status: 422 });
  }
  const schedule = (await scheduleRes.json()) as Schedule;

  const svg = buildSvg(schedule, detail as Detail, locale as Locale);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}

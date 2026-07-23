import { NextResponse } from "next/server";
import sharp from "sharp";
import { getDictionary, isLocale, nakshatraName, translateEnum, type Locale } from "@/lib/i18n";
import type { BirthChart, BirthNakshatraRequest, BirthNakshatraResponse, DashaTimeline } from "@/lib/api-client";

type ShareRequest = {
  locale: Locale;
  birth: BirthNakshatraRequest;
};

const FONT = "Noto Sans Sinhala, Noto Sans, DejaVu Sans, sans-serif";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}

function parseBody(body: unknown): ShareRequest | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const locale = record.locale;
  const birth = record.birth as Record<string, unknown> | null;
  if (typeof locale !== "string" || !isLocale(locale) || !birth || typeof birth !== "object") return null;
  if (!validDate(birth.birth_date) || !validTime(birth.birth_time)) return null;
  if (typeof birth.location_name !== "string" || birth.location_name.trim().length === 0 || birth.location_name.length > 100) {
    return null;
  }
  if (!finiteNumber(birth.latitude) || birth.latitude < -90 || birth.latitude > 90) return null;
  if (!finiteNumber(birth.longitude) || birth.longitude < -180 || birth.longitude > 180) return null;
  if (typeof birth.iana_tz !== "string" || birth.iana_tz.length === 0 || birth.iana_tz.length > 64) return null;
  return {
    locale,
    birth: {
      birth_date: birth.birth_date,
      birth_time: birth.birth_time.length === 5 ? `${birth.birth_time}:00` : birth.birth_time,
      location_name: birth.location_name.trim(),
      latitude: birth.latitude,
      longitude: birth.longitude,
      iana_tz: birth.iana_tz,
    },
  };
}

function currentDasha(dasha: DashaTimeline) {
  const today = new Date().toISOString().slice(0, 10);
  const mahadasha = dasha.periods.find((period) => period.start_date <= today && today < period.end_date);
  if (!mahadasha) return null;
  const antardasha = mahadasha.antardashas.find((period) => period.start_date <= today && today < period.end_date) ?? null;
  return { mahadasha, antardasha };
}

function keyPlacement(chart: BirthChart, key: string) {
  return chart.placements.find((placement) => placement.key === key);
}

async function postEngine<T>(apiBase: string, path: string, birth: BirthNakshatraRequest): Promise<T | null> {
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(birth),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function buildSvg(
  input: ShareRequest,
  identity: BirthNakshatraResponse,
  chart: BirthChart,
  dasha: DashaTimeline,
): string {
  const dict = getDictionary(input.locale);
  const W = 1200;
  const H = 630;
  const x = 72;
  const current = currentDasha(dasha);
  const nakshatra = nakshatraName(identity.nakshatra.index, input.locale);
  const paksha = translateEnum(dict, "paksha", identity.paksha);
  const moonRashi = translateEnum(dict, "rashis", identity.moon_rashi.key);
  const bird = translateEnum(dict, "birds", identity.birth_bird);
  const ascendant = translateEnum(dict, "rashis", chart.ascendant_rashi_key);
  const sun = keyPlacement(chart, "sun");
  const moon = keyPlacement(chart, "moon");
  const dashaLine = current
    ? `${translateEnum(dict, "horaPlanets", current.mahadasha.key)} / ${
        current.antardasha ? translateEnum(dict, "horaPlanets", current.antardasha.key) : dict.ui.none
      }`
    : dict.horoscopeReport.noCurrentDasha;
  const placementRows = [
    `${dict.birthChart.ascendant}: ${ascendant}`,
    sun ? `${translateEnum(dict, "horaPlanets", "sun")}: ${translateEnum(dict, "rashis", sun.rashi_key)}` : null,
    moon ? `${translateEnum(dict, "horaPlanets", "moon")}: ${translateEnum(dict, "rashis", moon.rashi_key)}` : null,
  ].filter((row): row is string => row !== null);

  const rows = [
    [dict.birthNakshatra.nakshatra, `${nakshatra} · ${dict.panchanga.pada} ${identity.nakshatra.pada}`],
    [dict.ui.paksha, paksha],
    [dict.birthNakshatra.moonRashi, moonRashi],
    [dict.ui.birthBird, bird],
  ]
    .map(
      ([label, value], index) => `<g>
        <rect x="${x}" y="${220 + index * 58}" width="470" height="44" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)"/>
        <text x="${x + 18}" y="${248 + index * 58}" font-family="${FONT}" font-size="18" font-weight="700" fill="rgba(255,255,255,0.70)">${esc(label)}</text>
        <text x="${x + 210}" y="${248 + index * 58}" font-family="${FONT}" font-size="22" font-weight="800" fill="#ffffff">${esc(value)}</text>
      </g>`,
    )
    .join("\n");

  const chartRows = placementRows
    .map(
      (row, index) =>
        `<text x="698" y="${335 + index * 38}" font-family="${FONT}" font-size="24" font-weight="700" fill="#ffffff">${esc(row)}</text>`,
    )
    .join("\n");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="report" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="0.48" stop-color="#0f766e"/>
      <stop offset="1" stop-color="#713f12"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#report)"/>
  <circle cx="1000" cy="96" r="116" fill="rgba(255,255,255,0.08)"/>
  <path d="M960 60 A58 58 0 1 0 1032 142 A42 42 0 1 1 960 60" fill="#facc15" opacity="0.9"/>
  <text x="${x}" y="76" font-family="${FONT}" font-size="28" font-weight="700" fill="rgba(255,255,255,0.88)">Fernando Family Astrology</text>
  <text x="${x}" y="148" font-family="${FONT}" font-size="50" font-weight="850" fill="#ffffff">${esc(dict.horoscopeReport.title)}</text>
  <text x="${x}" y="196" font-family="${FONT}" font-size="23" fill="rgba(255,255,255,0.76)">${esc(dict.horoscopeReport.privacyNote)}</text>
  ${rows}
  <g transform="translate(708 156)">
    <rect x="-28" y="-20" width="400" height="346" rx="18" fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.2)"/>
    <rect x="62" y="28" width="208" height="208" fill="none" stroke="#f8dfa5" stroke-width="4"/>
    <path d="M62 28 L270 236 M270 28 L62 236 M166 28 L270 132 L166 236 L62 132 Z" fill="none" stroke="#f8dfa5" stroke-width="3"/>
    <circle cx="166" cy="132" r="8" fill="#f59e0b"/>
  </g>
  <text x="680" y="290" font-family="${FONT}" font-size="18" font-weight="800" fill="rgba(255,255,255,0.64)">${esc(dict.horoscopeReport.chartTitle)}</text>
  ${chartRows}
  <text x="680" y="478" font-family="${FONT}" font-size="18" font-weight="800" fill="rgba(255,255,255,0.64)">${esc(dict.horoscopeReport.currentDashaTitle)}</text>
  <text x="680" y="518" font-family="${FONT}" font-size="30" font-weight="850" fill="#ffffff">${esc(dashaLine)}</text>
  <text x="${W - x}" y="${H - 34}" text-anchor="end" font-family="${FONT}" font-size="18" fill="rgba(255,255,255,0.6)">astrology.fernandofamily.com</text>
</svg>`;
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const body = parseBody(raw);
  if (!body) return NextResponse.json({ error: "invalid_share_request" }, { status: 422 });

  const apiBase = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8100";
  try {
    const [identity, chart, dasha] = await Promise.all([
      postEngine<BirthNakshatraResponse>(apiBase, "/api/v1/birth-nakshatra/resolve", body.birth),
      postEngine<BirthChart>(apiBase, "/api/v1/birth-chart/rasi", body.birth),
      postEngine<DashaTimeline>(apiBase, "/api/v1/dasha/mahadasha", body.birth),
    ]);
    if (!identity || !chart || !dasha) {
      return NextResponse.json({ error: "invalid_horoscope_request" }, { status: 422 });
    }
    const svg = buildSvg(body, identity, chart, dasha);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "engine_unreachable" }, { status: 503 });
  }
}

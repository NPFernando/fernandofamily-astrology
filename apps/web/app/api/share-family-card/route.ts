import { NextResponse } from "next/server";
import sharp from "sharp";
import en from "@/locales/en.json";
import si from "@/locales/si.json";

const LOCALES = ["en", "si"] as const;
const BIRDS = ["vulture", "owl", "crow", "cock", "peacock"] as const;
const PAKSHAS = ["waxing", "waning"] as const;
const FORBIDDEN_KEYS = new Set(["birth_date", "birth_time", "birth_latitude", "birth_longitude", "birth_location"]);
const DICTS = { en, si } as const;

type Locale = (typeof LOCALES)[number];
type Bird = (typeof BIRDS)[number];
type Paksha = (typeof PAKSHAS)[number];

type ShareProfile = {
  label: string;
  bird: Bird | null;
  nakshatra_index: number | null;
  paksha: Paksha | null;
  moon_rashi_index: number | null;
};

type ShareRequest = {
  locale: Locale;
  date: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    iana_tz: string;
  };
  profiles: ShareProfile[];
};

type MuhurtaWindow = {
  effective_date: string;
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  grade: "excellent" | "good" | "usable";
  score: number;
  pancha_pakshi_effect: string;
  pancha_pakshi_activity: string;
};

type MuhurtaRow = {
  profile: ShareProfile;
  windows: MuhurtaWindow[];
};

type DailyPanchanga = {
  date: string;
  paksha: string;
  is_poya_day: boolean;
  sinhala_month: { key: string };
  poya?: { month_key: string } | null;
  next_poya: { date: string; month_key: string };
};

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function containsForbiddenKeys(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenKeys);
  return Object.entries(value).some(([key, item]) => FORBIDDEN_KEYS.has(key) || containsForbiddenKeys(item));
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseBody(body: unknown): ShareRequest | null {
  if (!body || typeof body !== "object" || containsForbiddenKeys(body)) return null;
  const record = body as Record<string, unknown>;
  const locale = record.locale;
  const location = record.location as Record<string, unknown> | null;
  const profiles = record.profiles;

  if (!LOCALES.includes(locale as Locale) || !validDate(record.date)) return null;
  if (!location || typeof location !== "object") return null;
  if (typeof location.name !== "string" || location.name.trim().length === 0 || location.name.length > 100) return null;
  if (!finiteNumber(location.latitude) || location.latitude < -90 || location.latitude > 90) return null;
  if (!finiteNumber(location.longitude) || location.longitude < -180 || location.longitude > 180) return null;
  if (typeof location.iana_tz !== "string" || location.iana_tz.length > 64) return null;
  if (!Array.isArray(profiles) || profiles.length === 0 || profiles.length > 4) return null;

  const parsedProfiles: ShareProfile[] = [];
  for (const profile of profiles) {
    if (!profile || typeof profile !== "object") return null;
    const item = profile as Record<string, unknown>;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const bird = item.bird == null ? null : String(item.bird);
    const nakshatra = item.nakshatra_index == null ? null : Number(item.nakshatra_index);
    const paksha = item.paksha == null ? null : String(item.paksha);
    const moonRashi = item.moon_rashi_index == null ? null : Number(item.moon_rashi_index);
    if (!label || label.length > 100) return null;
    if (bird !== null && !BIRDS.includes(bird as Bird)) return null;
    if (nakshatra !== null && (!Number.isInteger(nakshatra) || nakshatra < 1 || nakshatra > 27)) return null;
    if (paksha !== null && !PAKSHAS.includes(paksha as Paksha)) return null;
    if (moonRashi !== null && (!Number.isInteger(moonRashi) || moonRashi < 1 || moonRashi > 12)) return null;
    if (bird === null && (nakshatra === null || paksha === null)) return null;
    parsedProfiles.push({
      label,
      bird: bird as Bird | null,
      nakshatra_index: nakshatra,
      paksha: paksha as Paksha | null,
      moon_rashi_index: moonRashi,
    });
  }

  return {
    locale: locale as Locale,
    date: record.date as string,
    location: {
      name: location.name.trim(),
      latitude: location.latitude as number,
      longitude: location.longitude as number,
      iana_tz: location.iana_tz as string,
    },
    profiles: parsedProfiles,
  };
}

function fmtDate(date: string, locale: Locale) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtTime(iso: string, locale: Locale, tz: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

function translate(dict: typeof en, group: "birds" | "effects" | "activities" | "sinhalaMonths" | "paksha", key: string) {
  const table = dict.enums[group] as Record<string, string>;
  return table[key] ?? key;
}

function panchangaLine(panchanga: DailyPanchanga, locale: Locale) {
  const dict = DICTS[locale];
  const monthKey = panchanga.is_poya_day && panchanga.poya ? panchanga.poya.month_key : panchanga.sinhala_month.key;
  const poya = panchanga.is_poya_day ? dict.panchanga.poyaTodayLabel : `${dict.panchanga.nextPoyaLabel}: ${panchanga.next_poya.date}`;
  return `${translate(dict, "sinhalaMonths", monthKey)} · ${translate(dict, "paksha", panchanga.paksha)} · ${poya}`;
}

function bestWindow(windows: MuhurtaWindow[], date: string): MuhurtaWindow | null {
  return [...windows]
    .filter((window) => window.effective_date === date)
    .sort((a, b) => {
      const grade = ["excellent", "good", "usable"].indexOf(a.grade) - ["excellent", "good", "usable"].indexOf(b.grade);
      if (grade !== 0) return grade;
      if (a.score !== b.score) return b.score - a.score;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    })[0] ?? null;
}

function buildSvg(input: ShareRequest, panchanga: DailyPanchanga, rows: MuhurtaRow[]): string {
  const dict = DICTS[input.locale];
  const W = 1200;
  const H = 630;
  const x = 72;
  const dateLine = fmtDate(input.date, input.locale);
  const rowSvg = rows
    .slice(0, 4)
    .map((row, index) => {
      const y = 330 + index * 62;
      const window = bestWindow(row.windows, input.date);
      const bird = row.profile.bird ? translate(dict, "birds", row.profile.bird) : dict.familyAlmanac.profileNakshatraOnly;
      const time = window
        ? `${fmtTime(window.starts_at, input.locale, input.location.iana_tz)}-${fmtTime(window.ends_at, input.locale, input.location.iana_tz)}`
        : dict.familyAlmanac.noWindows;
      const meta = window
        ? `${dict.muhurta.grades[window.grade]} · ${translate(dict, "effects", window.pancha_pakshi_effect)}`
        : dict.familyAlmanac.noWindowStatus;
      return `<g>
        <rect x="${x}" y="${y - 34}" width="${W - x * 2}" height="50" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.18)"/>
        <text x="${x + 20}" y="${y}" font-family="Noto Sans Sinhala, Noto Sans, sans-serif" font-size="23" font-weight="700" fill="#ffffff">${esc(row.profile.label)}</text>
        <text x="${x + 290}" y="${y}" font-family="Noto Sans Sinhala, Noto Sans, sans-serif" font-size="20" fill="rgba(255,255,255,0.78)">${esc(bird)}</text>
        <text x="${W - x - 20}" y="${y - 3}" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${esc(time)}</text>
        <text x="${W - x - 20}" y="${y + 20}" text-anchor="end" font-family="Noto Sans Sinhala, Noto Sans, sans-serif" font-size="15" fill="rgba(255,255,255,0.68)">${esc(meta)}</text>
      </g>`;
    })
    .join("\n");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="family" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="0.54" stop-color="#14532d"/>
      <stop offset="1" stop-color="#78350f"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#family)"/>
  <text x="${x}" y="76" font-family="Noto Sans, sans-serif" font-size="28" font-weight="700" fill="rgba(255,255,255,0.88)">Fernando Family Astrology</text>
  <text x="${x}" y="148" font-family="Noto Sans Sinhala, Noto Sans, sans-serif" font-size="48" font-weight="800" fill="#ffffff">${esc(dict.familyAlmanac.title)}</text>
  <text x="${x}" y="198" font-family="Noto Sans Sinhala, Noto Sans, sans-serif" font-size="28" fill="rgba(255,255,255,0.86)">${esc(dateLine)} · ${esc(input.location.name)}</text>
  <text x="${x}" y="250" font-family="Noto Sans Sinhala, Noto Sans, sans-serif" font-size="23" fill="rgba(255,255,255,0.76)">${esc(panchangaLine(panchanga, input.locale))}</text>
  <text x="${x}" y="298" font-family="Noto Sans Sinhala, Noto Sans, sans-serif" font-size="18" font-weight="700" fill="rgba(255,255,255,0.62)">${esc(dict.familyAlmanac.bestIndividualWindow)}</text>
  ${rowSvg}
  <text x="${W - x}" y="${H - 34}" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="18" fill="rgba(255,255,255,0.6)">astrology.fernandofamily.com</text>
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
  const location = {
    location_name: body.location.name,
    latitude: body.location.latitude,
    longitude: body.location.longitude,
    iana_tz: body.location.iana_tz,
  };

  try {
    const panchangaRes = await fetch(`${apiBase}/api/v1/panchanga/daily`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: body.date, ...location }),
    });
    if (!panchangaRes.ok) return NextResponse.json({ error: "invalid_panchanga_request" }, { status: 422 });
    const panchanga = (await panchangaRes.json()) as DailyPanchanga;
    const muhurtaRows = await Promise.all(
      body.profiles.map(async (profile) => {
        const identity = profile.bird
          ? { method: "bird", bird: profile.bird }
          : { method: "nakshatra_paksha", nakshatra_index: profile.nakshatra_index, paksha: profile.paksha };
        const res = await fetch(`${apiBase}/api/v1/muhurta/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...identity,
            ...location,
            from_date: body.date,
            days: 7,
            purpose: "general",
            min_effect: "good",
            min_duration_seconds: 900,
          }),
        });
        if (!res.ok) return { profile, windows: [] };
        const data = (await res.json()) as { windows: MuhurtaWindow[] };
        return { profile, windows: data.windows };
      }),
    );
    const svg = buildSvg(body, panchanga, muhurtaRows);
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

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAccountSession } from "@/lib/account-api";

const BIRDS = ["vulture", "owl", "crow", "cock", "peacock"];
const LOCALES = ["en", "si"];
const THEMES = ["light", "dark"];

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function normalizeLocation(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "object" || value === null) return "invalid";
  const loc = value as Record<string, unknown>;
  const name = typeof loc.name === "string" ? loc.name.trim() : "";
  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  const ianaTz = typeof loc.iana_tz === "string" ? loc.iana_tz.trim() : "";
  if (!name || name.length > 120) return "invalid";
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return "invalid";
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return "invalid";
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: ianaTz });
  } catch {
    return "invalid";
  }
  const raw = JSON.stringify({ name, latitude, longitude, iana_tz: ianaTz });
  return raw.length > 500 ? "invalid" : raw;
}

export async function GET() {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  const rows = await query(
    `SELECT locale, theme, default_bird, default_location, updated_at
       FROM preferences WHERE owner_email = $1`,
    [gate.email],
  );
  return NextResponse.json({ preferences: rows[0] ?? null });
}

export async function PUT(request: Request) {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const hasLocale = hasOwn(body, "locale");
  const locale = !hasLocale || body.locale == null ? null : String(body.locale);
  if (locale !== null && !LOCALES.includes(locale)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 422 });
  }
  const hasTheme = hasOwn(body, "theme");
  const theme = !hasTheme || body.theme == null ? null : String(body.theme);
  if (theme !== null && !THEMES.includes(theme)) {
    return NextResponse.json({ error: "invalid_theme" }, { status: 422 });
  }
  const hasDefaultBird = hasOwn(body, "default_bird");
  const defaultBird = !hasDefaultBird || body.default_bird == null ? null : String(body.default_bird);
  if (defaultBird !== null && !BIRDS.includes(defaultBird)) {
    return NextResponse.json({ error: "invalid_bird" }, { status: 422 });
  }
  const hasDefaultLocation = hasOwn(body, "default_location");
  let defaultLocation: string | null = null;
  if (hasDefaultLocation) {
    // default_location is a {name, latitude, longitude, iana_tz} the user
    // explicitly chose as their default — bounded to keep the jsonb small.
    const normalized = normalizeLocation(body.default_location);
    if (normalized === "invalid") return NextResponse.json({ error: "invalid_location" }, { status: 422 });
    defaultLocation = normalized;
  }

  // Partial-update semantics: omitted fields stay unchanged, explicit null
  // clears that saved preference.
  const rows = await query(
    `INSERT INTO preferences (owner_email, locale, theme, default_bird, default_location, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now())
     ON CONFLICT (owner_email) DO UPDATE
        SET locale = CASE WHEN $6 THEN EXCLUDED.locale ELSE preferences.locale END,
            theme = CASE WHEN $7 THEN EXCLUDED.theme ELSE preferences.theme END,
            default_bird = CASE WHEN $8 THEN EXCLUDED.default_bird ELSE preferences.default_bird END,
            default_location = CASE WHEN $9 THEN EXCLUDED.default_location ELSE preferences.default_location END,
            updated_at = now()
     RETURNING locale, theme, default_bird, default_location, updated_at`,
    [gate.email, locale, theme, defaultBird, defaultLocation, hasLocale, hasTheme, hasDefaultBird, hasDefaultLocation],
  );
  return NextResponse.json({ preferences: rows[0] });
}

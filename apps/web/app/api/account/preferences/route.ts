import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAccountSession } from "@/lib/account-api";

const BIRDS = ["vulture", "owl", "crow", "cock", "peacock"];
const LOCALES = ["en", "si"];
const THEMES = ["light", "dark"];

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

  const locale = body.locale == null ? null : String(body.locale);
  if (locale !== null && !LOCALES.includes(locale)) {
    return NextResponse.json({ error: "invalid_locale" }, { status: 422 });
  }
  const theme = body.theme == null ? null : String(body.theme);
  if (theme !== null && !THEMES.includes(theme)) {
    return NextResponse.json({ error: "invalid_theme" }, { status: 422 });
  }
  const defaultBird = body.default_bird == null ? null : String(body.default_bird);
  if (defaultBird !== null && !BIRDS.includes(defaultBird)) {
    return NextResponse.json({ error: "invalid_bird" }, { status: 422 });
  }
  // default_location is a {name, latitude, longitude, iana_tz} the user
  // explicitly chose as their default — bounded to keep the jsonb small.
  let defaultLocation: string | null = null;
  if (body.default_location != null) {
    const raw = JSON.stringify(body.default_location);
    if (raw.length > 500) return NextResponse.json({ error: "invalid_location" }, { status: 422 });
    defaultLocation = raw;
  }

  // Partial-update semantics: a PUT carrying only {theme} must not null out
  // the other columns — COALESCE keeps the stored value wherever the request
  // omitted a field. (Consequence: fields can be set but not cleared via
  // this endpoint; acceptable for preferences, revisit if clearing is ever
  // needed.)
  const rows = await query(
    `INSERT INTO preferences (owner_email, locale, theme, default_bird, default_location, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now())
     ON CONFLICT (owner_email) DO UPDATE
        SET locale = COALESCE(EXCLUDED.locale, preferences.locale),
            theme = COALESCE(EXCLUDED.theme, preferences.theme),
            default_bird = COALESCE(EXCLUDED.default_bird, preferences.default_bird),
            default_location = COALESCE(EXCLUDED.default_location, preferences.default_location),
            updated_at = now()
     RETURNING locale, theme, default_bird, default_location, updated_at`,
    [gate.email, locale, theme, defaultBird, defaultLocation],
  );
  return NextResponse.json({ preferences: rows[0] });
}

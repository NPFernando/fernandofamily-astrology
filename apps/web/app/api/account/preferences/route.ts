import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAccountSession } from "@/lib/account-api";

const BIRDS = ["vulture", "owl", "crow", "cock", "peacock"];
const LOCALES = ["en", "si"];
const THEMES = ["light", "dark"];

function hasOwn(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

export async function GET() {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  const rows = await query(
    `SELECT locale, theme, default_bird, default_location, updated_at
       FROM preferences WHERE owner_email = $1`,
    [gate.email],
  );
  const preferences = rows[0]
    ? { ...rows[0], default_location: null }
    : null;
  return NextResponse.json({
    preferences,
    legacy_location_pending: Boolean(rows[0]?.default_location),
  });
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

  if (hasOwn(body, "default_location")) {
    return NextResponse.json(
      { error: "location_requires_private_vault" },
      { status: 410 },
    );
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
  // Account sync contains non-location presentation preferences only. Precise
  // location stays in the passphrase-protected browser vault.
  const rows = await query(
    `INSERT INTO preferences (owner_email, locale, theme, default_bird, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (owner_email) DO UPDATE
        SET locale = CASE WHEN $5 THEN EXCLUDED.locale ELSE preferences.locale END,
            theme = CASE WHEN $6 THEN EXCLUDED.theme ELSE preferences.theme END,
            default_bird = CASE WHEN $7 THEN EXCLUDED.default_bird ELSE preferences.default_bird END,
            updated_at = now()
     RETURNING locale, theme, default_bird, updated_at`,
    [gate.email, locale, theme, defaultBird, hasLocale, hasTheme, hasDefaultBird],
  );
  return NextResponse.json({ preferences: rows[0] ? { ...rows[0], default_location: null } : null });
}

import { NextResponse } from "next/server";
import { requireAccountSession } from "@/lib/account-api";
import { normalizeAccountLocation } from "@/lib/account-location";
import { query } from "@/lib/db";

function serializeLocation(value: unknown): string | null {
  const location = normalizeAccountLocation(value);
  if (location === null || location === "invalid") return null;
  // The original account endpoint already validated the fields. Preserve its
  // coordinate precision when moving into the encrypted local vault.
  const raw = value as Record<string, unknown>;
  const serialized = JSON.stringify({
    ...location,
    latitude: Number(raw.latitude),
    longitude: Number(raw.longitude),
  });
  return serialized.length <= 500 ? serialized : null;
}

export async function GET() {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  const rows = await query(
    `SELECT default_location, updated_at::text AS revision
       FROM preferences
      WHERE owner_email = $1`,
    [gate.email],
  );
  const raw = rows[0]?.default_location ?? null;
  const serialized = serializeLocation(raw);
  return NextResponse.json({
    location: serialized ? JSON.parse(serialized) : null,
    // The timestamp is a non-sensitive compare token. It lets the owner remove
    // an invalid legacy value explicitly without returning that value to the
    // browser or exposing a guessable hash of low-entropy location data.
    revision: raw !== null ? rows[0]?.revision ?? null : null,
    pending: raw !== null,
    invalid_legacy_location: raw !== null && serialized === null,
  });
}

/** Clear a value only after vault migration or explicit invalid-value discard. */
export async function POST(request: Request) {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const revision = typeof body.revision === "string" ? body.revision : "";
  if (revision.length > 64 || !Number.isFinite(Date.parse(revision))) {
    return NextResponse.json({ error: "invalid_revision" }, { status: 422 });
  }

  const discardInvalid = body.discard_invalid === true;
  if (discardInvalid) {
    const current = await query(
      `SELECT default_location, updated_at::text AS revision
         FROM preferences
        WHERE owner_email = $1`,
      [gate.email],
    );
    if (!current[0] || current[0].revision !== revision) {
      return NextResponse.json({ cleared: false });
    }
    if (serializeLocation(current[0].default_location) !== null) {
      return NextResponse.json({ error: "location_is_valid_and_must_be_migrated" }, { status: 409 });
    }
  }

  const rows = await query(
    `UPDATE preferences
        SET default_location = NULL, updated_at = now()
      WHERE owner_email = $1
        AND updated_at = $2::timestamptz
      RETURNING owner_email`,
    [gate.email, revision],
  );
  return NextResponse.json({ cleared: rows.length === 1 });
}

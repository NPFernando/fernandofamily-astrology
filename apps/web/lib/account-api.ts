import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authEnabled } from "@/lib/auth-flag";
import { dbConfigured } from "@/lib/db";

const BIRDS = ["vulture", "owl", "crow", "cock", "peacock"] as const;
const PAKSHAS = ["waxing", "waning"] as const;

export type ProfileBody = {
  label?: unknown;
  bird?: unknown;
  nakshatra_index?: unknown;
  paksha?: unknown;
  moon_rashi_index?: unknown;
};

// Shared gate for every /api/account/* handler: 404 when the account system
// isn't switched on at all (indistinguishable from a route that doesn't
// exist), 401 when it is but the request carries no session. The email used
// for every query comes from the session token here — never from a request
// body or query string.
export async function requireAccountSession(): Promise<
  { ok: true; email: string } | { ok: false; response: NextResponse }
> {
  if (!authEnabled || !dbConfigured()) {
    return { ok: false, response: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return { ok: false, response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { ok: true, email };
}

// Mirrors the DB CHECK constraints so bad input fails with a clean 422
// before ever reaching Postgres.
export function validateProfileBody(
  body: ProfileBody,
): { ok: true; label: string; bird: string | null; nakshatra_index: number | null; paksha: string | null; moon_rashi_index: number | null } | { ok: false; message: string } {
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label || label.length > 100) return { ok: false, message: "label must be a non-empty string (max 100 chars)" };

  const bird = body.bird == null ? null : String(body.bird);
  if (bird !== null && !(BIRDS as readonly string[]).includes(bird)) {
    return { ok: false, message: "invalid bird" };
  }

  const nak = body.nakshatra_index == null ? null : Number(body.nakshatra_index);
  if (nak !== null && (!Number.isInteger(nak) || nak < 1 || nak > 27)) {
    return { ok: false, message: "nakshatra_index must be 1..27" };
  }

  const paksha = body.paksha == null ? null : String(body.paksha);
  if (paksha !== null && !(PAKSHAS as readonly string[]).includes(paksha)) {
    return { ok: false, message: "invalid paksha" };
  }

  const moonRashi = body.moon_rashi_index == null ? null : Number(body.moon_rashi_index);
  if (moonRashi !== null && (!Number.isInteger(moonRashi) || moonRashi < 1 || moonRashi > 12)) {
    return { ok: false, message: "moon_rashi_index must be 1..12" };
  }

  if (bird === null && (nak === null || paksha === null)) {
    return { ok: false, message: "provide bird, or nakshatra_index + paksha" };
  }

  return { ok: true, label, bird, nakshatra_index: nak, paksha, moon_rashi_index: moonRashi };
}

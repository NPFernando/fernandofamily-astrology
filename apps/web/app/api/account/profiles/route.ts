import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAccountSession, validateProfileBody } from "@/lib/account-api";

export async function GET() {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  const rows = await query(
    `SELECT id, label, bird, nakshatra_index, paksha, moon_rashi_index, created_at, updated_at
       FROM profiles WHERE owner_email = $1 ORDER BY created_at`,
    [gate.email],
  );
  return NextResponse.json({ profiles: rows });
}

export async function POST(request: Request) {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = validateProfileBody(body as Parameters<typeof validateProfileBody>[0]);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_profile", message: parsed.message }, { status: 422 });
  }

  const rows = await query(
    `INSERT INTO profiles (owner_email, label, bird, nakshatra_index, paksha, moon_rashi_index)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, label, bird, nakshatra_index, paksha, moon_rashi_index, created_at, updated_at`,
    [gate.email, parsed.label, parsed.bird, parsed.nakshatra_index, parsed.paksha, parsed.moon_rashi_index],
  );
  return NextResponse.json({ profile: rows[0] }, { status: 201 });
}

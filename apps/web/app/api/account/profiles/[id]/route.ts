import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAccountSession, validateProfileBody } from "@/lib/account-api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

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

  // owner_email in the WHERE clause (from the session, never the body) is
  // what stops one account touching another's rows.
  const rows = await query(
    `UPDATE profiles
        SET label = $1,
            bird = $2,
            nakshatra_index = $3,
            paksha = $4,
            moon_rashi_index = $5,
            updated_at = now()
      WHERE id = $6 AND owner_email = $7
      RETURNING id, label, bird, nakshatra_index, paksha, moon_rashi_index, created_at, updated_at`,
    [parsed.label, parsed.bird, parsed.nakshatra_index, parsed.paksha, parsed.moon_rashi_index, id, gate.email],
  );
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ profile: rows[0] });
}

export async function DELETE(_request: Request, { params }: Params) {
  const gate = await requireAccountSession();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await query(
    `DELETE FROM profiles WHERE id = $1 AND owner_email = $2 RETURNING id`,
    [id, gate.email],
  );
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}

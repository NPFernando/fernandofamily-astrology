import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isMissingTableError, requirePushSystem } from "@/lib/push-api";

export async function POST(request: Request) {
  const gate = requirePushSystem();
  if (!gate.ok) return gate.response;

  let body: { endpoint?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.endpoint !== "string" || !body.endpoint) {
    return NextResponse.json({ error: "invalid_endpoint" }, { status: 422 });
  }

  try {
    await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [body.endpoint]);
    await query(`DELETE FROM push_sent WHERE endpoint = $1`, [body.endpoint]);
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    }
    throw e;
  }
  return NextResponse.json({ unsubscribed: true });
}

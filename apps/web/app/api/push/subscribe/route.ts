import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  isMissingTableError,
  requirePushEnabled,
  requirePushStorage,
  validateSubscribeBody,
  type SubscribeBody,
} from "@/lib/push-api";

export async function POST(request: Request) {
  const gate = requirePushEnabled();
  if (!gate.ok) return gate.response;

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = validateSubscribeBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_subscription", message: parsed.message }, { status: 422 });
  }
  const v = parsed.value;

  const storage = requirePushStorage();
  if (!storage.ok) return storage.response;

  try {
    await query(
      `INSERT INTO push_subscriptions
         (endpoint, p256dh, auth, bird, nakshatra_index, paksha,
          latitude, longitude, iana_tz, min_effect, lead_minutes, locale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (endpoint) DO UPDATE
          SET p256dh = EXCLUDED.p256dh,
              auth = EXCLUDED.auth,
              bird = EXCLUDED.bird,
              nakshatra_index = EXCLUDED.nakshatra_index,
              paksha = EXCLUDED.paksha,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              iana_tz = EXCLUDED.iana_tz,
              min_effect = EXCLUDED.min_effect,
              lead_minutes = EXCLUDED.lead_minutes,
              locale = EXCLUDED.locale,
              failures = 0`,
      [
        v.endpoint, v.p256dh, v.auth, v.bird, v.nakshatra_index, v.paksha,
        v.latitude, v.longitude, v.iana_tz, v.min_effect, v.lead_minutes, v.locale,
      ],
    );
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    }
    throw e;
  }
  return NextResponse.json({ subscribed: true });
}

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  isPushStorageUnavailableError,
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
          latitude, longitude, iana_tz, min_effect, lead_minutes, quiet_start_hour, quiet_end_hour, allowed_weekdays, max_alerts_per_day, locale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
              quiet_start_hour = EXCLUDED.quiet_start_hour,
              quiet_end_hour = EXCLUDED.quiet_end_hour,
              allowed_weekdays = EXCLUDED.allowed_weekdays,
              max_alerts_per_day = EXCLUDED.max_alerts_per_day,
              locale = EXCLUDED.locale,
              failures = 0`,
      [
        v.endpoint, v.p256dh, v.auth, v.bird, v.nakshatra_index, v.paksha,
        v.latitude, v.longitude, v.iana_tz, v.min_effect, v.lead_minutes, v.quiet_start_hour, v.quiet_end_hour, v.allowed_weekdays, v.max_alerts_per_day, v.locale,
      ],
    );
  } catch (e) {
    if (isPushStorageUnavailableError(e)) {
      return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    }
    throw e;
  }
  return NextResponse.json({ subscribed: true });
}

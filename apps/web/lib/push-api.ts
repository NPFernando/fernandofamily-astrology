import "server-only";
import { NextResponse } from "next/server";
import { pushEnabled } from "@/lib/push-flag";
import { dbConfigured } from "@/lib/db";

const BIRDS = ["vulture", "owl", "crow", "cock", "peacock"] as const;
const PAKSHAS = ["waxing", "waning"] as const;
const EFFECTS = ["good", "very_good"] as const;
const LOCALES = ["en", "si"] as const;

export type PushGate = { ok: true } | { ok: false; response: NextResponse };

// Shared gates for /api/push/*: 404 when push isn't switched on (route looks
// nonexistent), 503 when it is on but server storage isn't reachable.
export function requirePushEnabled(): PushGate {
  if (!pushEnabled) {
    return { ok: false, response: NextResponse.json({ error: "not_found" }, { status: 404 }) };
  }
  return { ok: true };
}

export function requirePushStorage(): PushGate {
  if (!dbConfigured()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "storage_unavailable" }, { status: 503 }),
    };
  }
  return { ok: true };
}

export function requirePushSystem(): PushGate {
  const enabled = requirePushEnabled();
  if (!enabled.ok) return enabled;
  return requirePushStorage();
}

export type SubscribeBody = {
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  bird?: unknown;
  nakshatra_index?: unknown;
  paksha?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  iana_tz?: unknown;
  min_effect?: unknown;
  lead_minutes?: unknown;
  locale?: unknown;
};

export type ValidSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
  bird: string | null;
  nakshatra_index: number | null;
  paksha: string | null;
  latitude: number;
  longitude: number;
  iana_tz: string;
  min_effect: string;
  lead_minutes: number;
  locale: string;
};

// Mirrors the DB CHECK constraints so bad input fails with a clean 422
// before reaching Postgres. Coordinates are rounded to 2 decimals (~1km)
// HERE, server-side — the client's rounding is never trusted.
export function validateSubscribeBody(
  body: SubscribeBody,
): { ok: true; value: ValidSubscription } | { ok: false; message: string } {
  const endpoint = body.subscription?.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) {
    return { ok: false, message: "subscription.endpoint must be an https URL" };
  }
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;
  if (typeof p256dh !== "string" || !p256dh || p256dh.length > 300) {
    return { ok: false, message: "subscription.keys.p256dh required" };
  }
  if (typeof auth !== "string" || !auth || auth.length > 100) {
    return { ok: false, message: "subscription.keys.auth required" };
  }

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
  if (bird === null && (nak === null || paksha === null)) {
    return { ok: false, message: "provide bird, or nakshatra_index + paksha" };
  }

  const lat = Number(body.latitude);
  const lon = Number(body.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, message: "invalid latitude" };
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) return { ok: false, message: "invalid longitude" };

  const tz = typeof body.iana_tz === "string" ? body.iana_tz : "";
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch {
    return { ok: false, message: "invalid iana_tz" };
  }

  const minEffect = body.min_effect == null ? "very_good" : String(body.min_effect);
  if (!(EFFECTS as readonly string[]).includes(minEffect)) {
    return { ok: false, message: "min_effect must be good or very_good" };
  }
  const lead = body.lead_minutes == null ? 10 : Number(body.lead_minutes);
  if (!Number.isInteger(lead) || lead < 5 || lead > 60) {
    return { ok: false, message: "lead_minutes must be 5..60" };
  }
  const locale = body.locale == null ? "si" : String(body.locale);
  if (!(LOCALES as readonly string[]).includes(locale)) {
    return { ok: false, message: "invalid locale" };
  }

  return {
    ok: true,
    value: {
      endpoint,
      p256dh,
      auth,
      bird,
      nakshatra_index: nak,
      paksha,
      latitude: Math.round(lat * 100) / 100,
      longitude: Math.round(lon * 100) / 100,
      iana_tz: tz,
      min_effect: minEffect,
      lead_minutes: lead,
      locale,
    },
  };
}

// Postgres "relation does not exist" — the push migration hasn't been
// applied yet. Surfaced as the same clean 503 as "no DB configured".
export function isMissingTableError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "42P01";
}

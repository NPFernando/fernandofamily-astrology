import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import webpush from "web-push";
import { query } from "@/lib/db";
import { pushEnabled } from "@/lib/push-flag";
import { isMissingTableError } from "@/lib/push-api";
import en from "@/locales/en.json";
import si from "@/locales/si.json";

// This route is intentionally NOT carved out in nginx: public requests to
// /api/internal/* are routed to FastAPI (which has no such path → 404), so
// only loopback callers that reach the Next server directly (the host cron
// via 127.0.0.1:3100) can hit it — and they still need the shared secret.
// It's invoked every 5 minutes; the lead-window selection below is sized to
// that cadence so a window is caught exactly once.

const DICTS = { en, si } as const;
type Locale = keyof typeof DICTS;

const TICK_MS = 5 * 60 * 1000;

type SubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  bird: string | null;
  nakshatra_index: number | null;
  paksha: string | null;
  latitude: string; // numeric comes back as string from pg
  longitude: string;
  iana_tz: string;
  min_effect: string;
  lead_minutes: number;
  locale: string;
  failures: number;
};

type WindowEntry = {
  id: string;
  starts_at: string;
  sub_bird: string;
  sub_activity: string;
  effect: string;
  effective_date: string;
};

function windowsCacheKey(sub: SubscriptionRow): string {
  return [sub.bird, sub.nakshatra_index, sub.paksha, sub.latitude, sub.longitude, sub.iana_tz, sub.min_effect].join("|");
}

async function fetchWindowsFor(sub: SubscriptionRow): Promise<WindowEntry[]> {
  const apiBase = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8100";
  // Target the subscriber's current local time so the sunrise-day rollback
  // behaves exactly as it would for an interactive request from them.
  const nowThere = new Date().toLocaleString("sv-SE", { timeZone: sub.iana_tz });
  const [datePart, timePart] = nowThere.split(" ");
  const base = {
    target_date: datePart,
    target_time: timePart,
    location_name: "subscription",
    latitude: Number(sub.latitude),
    longitude: Number(sub.longitude),
    iana_tz: sub.iana_tz,
    days: 2,
    min_effect: sub.min_effect,
  };
  const body =
    sub.bird !== null
      ? { ...base, method: "bird", bird: sub.bird }
      : { ...base, method: "nakshatra_paksha", nakshatra_index: sub.nakshatra_index, paksha: sub.paksha };
  const res = await fetch(`${apiBase}/api/v1/pancha-pakshi/windows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.windows ?? []) as WindowEntry[];
}

function composeNotification(sub: SubscriptionRow, w: WindowEntry) {
  const locale: Locale = sub.locale === "en" ? "en" : "si";
  const dict = DICTS[locale];
  const enums = dict.enums as Record<string, Record<string, string>>;
  const startTime = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: sub.iana_tz,
  }).format(new Date(w.starts_at));
  const push = (dict as unknown as { push: { title: string; body: string } }).push;
  return {
    title: push.title,
    body: push.body
      .replace("{bird}", enums.birds[w.sub_bird] ?? w.sub_bird)
      .replace("{activity}", enums.activities[w.sub_activity] ?? w.sub_activity)
      .replace("{effect}", enums.effects[w.effect] ?? w.effect)
      .replace("{time}", startTime),
    url: `/${locale}/pancha-pakshi`,
  };
}

export async function POST(request: Request) {
  if (!pushEnabled) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const configuredKey = process.env.INTERNAL_DISPATCH_KEY;
  const providedKey = request.headers.get("x-internal-key");
  if (!configuredKey || providedKey !== configuredKey) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  let subs: SubscriptionRow[];
  try {
    subs = await query<SubscriptionRow>(
      `SELECT endpoint, p256dh, auth, bird, nakshatra_index, paksha,
              latitude, longitude, iana_tz, min_effect, lead_minutes, locale, failures
         FROM push_subscriptions ORDER BY created_at LIMIT 500`,
    );
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    }
    throw e;
  }

  const nowMs = Date.now();
  const windowsCache = new Map<string, Promise<WindowEntry[]>>();
  const wouldSend: { endpoint_hash: string; window_key: string; starts_at: string; title: string }[] = [];
  let sent = 0;
  let dropped = 0;

  for (const sub of subs) {
    const cacheKey = windowsCacheKey(sub);
    if (!windowsCache.has(cacheKey)) windowsCache.set(cacheKey, fetchWindowsFor(sub));
    const windows = await windowsCache.get(cacheKey)!;

    const leadMs = sub.lead_minutes * 60 * 1000;
    const due = windows.filter((w) => {
      const startMs = new Date(w.starts_at).getTime();
      // Fires when the window's start is between (lead − one tick) and lead
      // away — with the 5-minute cron cadence each window lands in exactly
      // one tick; push_sent below still guards against any overlap.
      return startMs - nowMs > leadMs - TICK_MS && startMs - nowMs <= leadMs;
    });

    for (const w of due) {
      const windowKey = `${w.effective_date}:${w.id}`;
      const already = await query(
        `SELECT 1 FROM push_sent WHERE endpoint = $1 AND window_key = $2`,
        [sub.endpoint, windowKey],
      );
      if (already.length > 0) continue;

      const payload = composeNotification(sub, w);
      if (dry) {
        wouldSend.push({
          endpoint_hash: createHash("sha256").update(sub.endpoint).digest("hex").slice(0, 12),
          window_key: windowKey,
          starts_at: w.starts_at,
          title: payload.title,
        });
        continue;
      }

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        await query(
          `INSERT INTO push_sent (endpoint, window_key) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [sub.endpoint, windowKey],
        );
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Push service says the subscription no longer exists.
          await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]);
          dropped += 1;
          break;
        }
        const failures = sub.failures + 1;
        if (failures >= 5) {
          await query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [sub.endpoint]);
          dropped += 1;
        } else {
          await query(`UPDATE push_subscriptions SET failures = $2 WHERE endpoint = $1`, [
            sub.endpoint,
            failures,
          ]);
        }
      }
    }
  }

  if (!dry) {
    await query(`DELETE FROM push_sent WHERE sent_at < now() - interval '2 days'`);
  }

  return dry
    ? NextResponse.json({ dry: true, subscriptions: subs.length, would_send: wouldSend })
    : NextResponse.json({ subscriptions: subs.length, sent, dropped });
}

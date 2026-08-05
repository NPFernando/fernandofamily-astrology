"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { usePushSupport } from "@/lib/use-push-support";
import type { BirdId, PakshaId } from "@/lib/api-client";

const LEAD_OPTIONS = [5, 10, 15, 30, 60];
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

// Chrome expects the applicationServerKey as a Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function NotificationOptIn({
  bird,
  nakshatraIndex,
  paksha,
  latitude,
  longitude,
  ianaTz,
}: {
  bird: BirdId | null;
  nakshatraIndex: number | null;
  paksha: PakshaId | null;
  latitude: number;
  longitude: number;
  ianaTz: string;
}) {
  const { dict, locale } = useLocale();
  const support = usePushSupport();
  const [subscribed, setSubscribed] = useState(false);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [minEffect, setMinEffect] = useState<"good" | "very_good">("very_good");
  const [leadMinutes, setLeadMinutes] = useState(10);
  const [quietStartHour, setQuietStartHour] = useState<number | null>(null);
  const [quietEndHour, setQuietEndHour] = useState<number | null>(null);
  const [allowedWeekdays, setAllowedWeekdays] = useState<number[]>(WEEKDAYS);
  const [maxAlertsPerDay, setMaxAlertsPerDay] = useState(3);

  useEffect(() => {
    if (!support.available) return;
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setSubscribed(Boolean(sub));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [support.available]);

  // Renders nothing when push isn't configured server-side or the browser
  // can't do it — the page looks exactly as it did before this feature.
  if (!support.available || !support.publicKey) return null;
  if (bird === null && (nakshatraIndex === null || paksha === null)) return null;

  async function saveSubscription(sub: PushSubscription) {
    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: { endpoint: sub.endpoint, keys: json.keys },
        bird,
        nakshatra_index: nakshatraIndex,
        paksha,
        latitude,
        longitude,
        iana_tz: ianaTz,
        min_effect: minEffect,
        lead_minutes: leadMinutes,
        quiet_start_hour: quietStartHour,
        quiet_end_hour: quietEndHour,
        allowed_weekdays: allowedWeekdays,
        max_alerts_per_day: maxAlertsPerDay,
        locale,
      }),
    });
    return res.ok;
  }

  async function enable() {
    setWorking(true);
    setStatus(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(dict.ui.notifyDenied);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(support.publicKey!) as BufferSource,
      });
      if (!(await saveSubscription(sub))) {
        await sub.unsubscribe().catch(() => undefined);
        setStatus(dict.ui.error);
        return;
      }
      setSubscribed(true);
    } catch {
      setStatus(dict.ui.error);
    } finally {
      setWorking(false);
    }
  }

  async function updatePreferences() {
    setWorking(true);
    setStatus(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (!sub || !(await saveSubscription(sub))) {
        setStatus(dict.ui.error);
        return;
      }
      setStatus(dict.ui.notifyPreferencesSaved);
    } catch {
      setStatus(dict.ui.error);
    } finally {
      setWorking(false);
    }
  }

  async function disable() {
    setWorking(true);
    setStatus(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch {
      setStatus(dict.ui.error);
    } finally {
      setWorking(false);
    }
  }

  async function sendTestAlert() {
    setWorking(true);
    setStatus(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(dict.ui.notifyTitle, {
        body: dict.ui.notifyTestSent,
        tag: "fernandofamily-notification-test",
      });
      setStatus(dict.ui.notifyTestSent);
    } catch {
      setStatus(dict.ui.error);
    } finally {
      setWorking(false);
    }
  }

  return (
    <details className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/10 print:hidden">
      <summary className="cursor-pointer font-semibold">{dict.ui.notifyTitle}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="opacity-80">{dict.ui.notifyBody}</p>

        <div className="grid gap-3 border-y border-black/10 py-3 dark:border-white/10 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase opacity-70">{dict.ui.notifyEffectLabel}</span>
            <select
              value={minEffect}
              onChange={(e) => setMinEffect(e.target.value as "good" | "very_good")}
              className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent"
            >
              <option value="very_good">{dict.ui.notifyEffectVeryGood}</option>
              <option value="good">{dict.ui.notifyEffectGood}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase opacity-70">{dict.ui.notifyLeadLabel}</span>
            <select value={leadMinutes} onChange={(e) => setLeadMinutes(Number(e.target.value))} className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent">
              {LEAD_OPTIONS.map((n) => <option key={n} value={n}>{dict.ui.notifyLeadMinutes.replace("{n}", String(n))}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase opacity-70">{dict.ui.notifyQuietStart}</span>
            <select value={quietStartHour ?? ""} onChange={(e) => setQuietStartHour(e.target.value === "" ? null : Number(e.target.value))} className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent">
              <option value="">{dict.ui.notifyQuietOff}</option>
              {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase opacity-70">{dict.ui.notifyQuietEnd}</span>
            <select value={quietEndHour ?? ""} onChange={(e) => setQuietEndHour(e.target.value === "" ? null : Number(e.target.value))} className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent">
              <option value="">{dict.ui.notifyQuietOff}</option>
              {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
            </select>
          </label>
          <fieldset className="flex flex-col gap-2 sm:col-span-2">
            <legend className="text-xs uppercase opacity-70">{dict.ui.notifyDaysLabel}</legend>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {WEEKDAYS.map((weekday) => (
                <label key={weekday} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={allowedWeekdays.includes(weekday)}
                    onChange={() => setAllowedWeekdays((current) => current.includes(weekday) ? current.filter((value) => value !== weekday) : [...current, weekday].sort())}
                  />
                  {new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", { weekday: "short" }).format(new Date(2024, 0, weekday))}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase opacity-70">{dict.ui.notifyDailyLimit}</span>
            <select value={maxAlertsPerDay} onChange={(e) => setMaxAlertsPerDay(Number(e.target.value))} className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{dict.ui.notifyDailyLimitValue.replace("{n}", String(n))}</option>)}
            </select>
          </label>
        </div>

        {subscribed ? (
          <>
            <p className="font-medium text-accent">{dict.ui.notifyActive}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={working}
                onClick={() => {
                  void sendTestAlert();
                }}
                className="w-fit rounded-lg border border-accent/40 px-4 py-2 text-accent dark:border-white/20 disabled:opacity-40"
              >
                {dict.ui.notifyTest}
              </button>
              <button type="button" disabled={working || allowedWeekdays.length === 0 || (quietStartHour === null) !== (quietEndHour === null) || quietStartHour === quietEndHour} onClick={() => { void updatePreferences(); }} className="w-fit rounded-lg border border-accent/40 px-4 py-2 text-accent dark:border-white/20 disabled:opacity-40">
                {dict.ui.notifySavePreferences}
              </button>
              <button
                type="button"
                disabled={working}
                onClick={disable}
                className="w-fit rounded-lg border border-black/10 px-4 py-2 dark:border-white/20 disabled:opacity-40"
              >
                {working ? dict.ui.notifyWorking : dict.ui.notifyDisable}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={working || allowedWeekdays.length === 0 || (quietStartHour === null) !== (quietEndHour === null) || quietStartHour === quietEndHour}
              onClick={enable}
              className="w-fit rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              {working ? dict.ui.notifyWorking : dict.ui.notifyEnable}
            </button>
          </>
        )}

        {status && <p className="text-red-600 dark:text-red-400">{status}</p>}
      </div>
    </details>
  );
}

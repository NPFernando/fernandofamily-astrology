"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { usePushSupport } from "@/lib/use-push-support";
import type { BirdId, PakshaId } from "@/lib/api-client";

const LEAD_OPTIONS = [5, 10, 15, 30, 60];

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
          locale,
        }),
      });
      if (!res.ok) {
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

  return (
    <details className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/10 print:hidden">
      <summary className="cursor-pointer font-semibold">{dict.ui.notifyTitle}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="opacity-80">{dict.ui.notifyBody}</p>

        {subscribed ? (
          <>
            <p className="font-medium text-accent">{dict.ui.notifyActive}</p>
            <button
              type="button"
              disabled={working}
              onClick={disable}
              className="w-fit rounded-lg border border-black/10 px-4 py-2 dark:border-white/20 disabled:opacity-40"
            >
              {working ? dict.ui.notifyWorking : dict.ui.notifyDisable}
            </button>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase opacity-70">{dict.ui.notifyEffectLabel}</span>
              <select
                value={minEffect}
                onChange={(e) => setMinEffect(e.target.value as "good" | "very_good")}
                className="w-fit rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent"
              >
                <option value="very_good">{dict.ui.notifyEffectVeryGood}</option>
                <option value="good">{dict.ui.notifyEffectGood}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase opacity-70">{dict.ui.notifyLeadLabel}</span>
              <select
                value={leadMinutes}
                onChange={(e) => setLeadMinutes(Number(e.target.value))}
                className="w-fit rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent"
              >
                {LEAD_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {dict.ui.notifyLeadMinutes.replace("{n}", String(n))}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={working}
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

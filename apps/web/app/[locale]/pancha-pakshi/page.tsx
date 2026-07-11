"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { resolveKey, translateEnum } from "@/lib/i18n";
import { features } from "@/lib/feature-registry";
import {
  ApiError,
  fetchScheduleWithServerTime,
  type ScheduleRequest,
  type ScheduleResponse,
} from "@/lib/api-client";
import { BirthInputForm } from "@/components/pancha-pakshi/BirthInputForm";
import { NakshatraPakshaForm } from "@/components/pancha-pakshi/NakshatraPakshaForm";
import { BirdSelector } from "@/components/pancha-pakshi/BirdSelector";
import { ScheduleTimeline } from "@/components/pancha-pakshi/ScheduleTimeline";
import { LiveCountdown } from "@/components/pancha-pakshi/LiveCountdown";

type Method = "birth_datetime" | "nakshatra_paksha" | "bird";

const SCHEDULE_CACHE_KEY = "ff_last_schedule_cache";

type CachedSchedule = { schedule: ScheduleResponse; cachedAtIso: string };

function loadCachedSchedule(): CachedSchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SCHEDULE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedSchedule) : null;
  } catch {
    return null;
  }
}

function saveCachedSchedule(schedule: ScheduleResponse) {
  window.localStorage.setItem(
    SCHEDULE_CACHE_KEY,
    JSON.stringify({ schedule, cachedAtIso: new Date().toISOString() } satisfies CachedSchedule),
  );
}

export default function PanchaPakshiPage() {
  const { dict, locale } = useLocale();
  const [method, setMethod] = useState<Method>("bird");
  const feature = features.find((f) => f.id === "pancha-pakshi")!;

  const [lastRequest, setLastRequest] = useState<ScheduleRequest | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [serverTime, setServerTime] = useState<Date | null>(null);
  const [fetchedAtClientMs, setFetchedAtClientMs] = useState<number>(0);
  const [isStale, setIsStale] = useState(false);
  const [cachedAtIso, setCachedAtIso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Deferred to an effect (not a lazy useState initializer) so the first
    // client render matches the server-rendered default (true) — navigator
    // isn't available during SSR, and avoiding a mismatch here matters
    // because this value gates whether the offline banner renders at all.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const runSchedule = useCallback(async (request: ScheduleRequest) => {
    setLastRequest(request);
    setLoading(true);
    setError(null);
    try {
      const { data, serverTime: st } = await fetchScheduleWithServerTime(request);
      setSchedule(data);
      setServerTime(st);
      setFetchedAtClientMs(Date.now());
      setIsStale(false);
      setCachedAtIso(null);
      saveCachedSchedule(data);
    } catch (e) {
      // Offline / request failed — fall back to the last cached schedule,
      // clearly labeled as cached, never presented as live. No client-side
      // fallback astronomical calculation is used.
      const cached = loadCachedSchedule();
      if (cached) {
        setSchedule(cached.schedule);
        setServerTime(null);
        setFetchedAtClientMs(Date.now());
        setIsStale(true);
        setCachedAtIso(cached.cachedAtIso);
      } else {
        setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
      }
    } finally {
      setLoading(false);
    }
  }, [dict.ui.error]);

  const refetch = useCallback(() => {
    if (lastRequest && isOnline) runSchedule(lastRequest);
  }, [lastRequest, isOnline, runSchedule]);

  const tabs: { id: Method; label: string }[] = [
    { id: "birth_datetime", label: dict.ui.methodBirthDetails },
    { id: "nakshatra_paksha", label: dict.ui.methodKnownNakshatra },
    { id: "bird", label: dict.ui.methodDirectBird },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{resolveKey(dict, feature.titleKey)}</h1>
        <p className="mt-1 opacity-80">{resolveKey(dict, feature.descriptionKey)}</p>
      </header>

      {!isOnline && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {dict.ui.offlineCachedNotice}
        </p>
      )}

      {schedule && (
        <div className="order-first flex flex-col gap-4 lg:order-none">
          {isStale && cachedAtIso && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              {dict.ui.offlineCachedNotice} — {dict.ui.generatedAt}:{" "}
              {new Date(cachedAtIso).toLocaleString(locale === "si" ? "si-LK" : "en-US")} · {schedule.location.name}
            </p>
          )}
          <LiveCountdown
            current={schedule.current_period}
            next={schedule.next_period}
            serverTime={serverTime}
            fetchedAtClientMs={fetchedAtClientMs}
            onExpire={refetch}
            isStale={isStale}
          />
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10 sm:grid-cols-4">
            <Fact label={dict.ui.location} value={schedule.location.name} />
            <Fact label={dict.ui.weekday} value={translateEnum(dict, "weekdays", schedule.weekday)} />
            <Fact label={dict.ui.paksha} value={translateEnum(dict, "paksha", schedule.paksha)} />
            <Fact label={dict.ui.birthBird} value={translateEnum(dict, "birds", schedule.birth_bird)} />
            <Fact label={dict.ui.sunrise} value={new Date(schedule.sunrise).toLocaleTimeString()} />
            <Fact label={dict.ui.sunset} value={new Date(schedule.sunset).toLocaleTimeString()} />
            <Fact label={dict.ui.nextSunrise} value={new Date(schedule.next_sunrise).toLocaleTimeString()} />
            <Fact label={dict.ui.paduPakshi} value={translateEnum(dict, "birds", schedule.padu_pakshi)} />
          </div>
          <ScheduleTimeline schedule={schedule} />
        </div>
      )}

      <div role="tablist" aria-label={dict.ui.birthDetails} className="flex gap-2 border-b border-black/10 dark:border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={method === tab.id}
            onClick={() => setMethod(tab.id)}
            className={`px-4 py-2 text-sm ${
              method === tab.id
                ? "border-b-2 border-accent font-semibold text-accent"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && <p className="text-sm opacity-70">{dict.ui.loading}</p>}

      <section role="tabpanel" className="rounded-xl border border-black/10 p-6 dark:border-white/10">
        {method === "birth_datetime" && <BirthInputForm onSubmit={runSchedule} />}
        {method === "nakshatra_paksha" && <NakshatraPakshaForm onSubmit={runSchedule} />}
        {method === "bird" && <BirdSelector onSubmit={runSchedule} />}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

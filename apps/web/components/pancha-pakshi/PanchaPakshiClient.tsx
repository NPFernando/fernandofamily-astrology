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
import { ScheduleSkeleton } from "@/components/pancha-pakshi/ScheduleSkeleton";
import { SavedProfiles } from "@/components/pancha-pakshi/SavedProfiles";
import { DEFAULT_LOCATION, mostRecentLocation } from "@/components/pancha-pakshi/LocationPicker";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";
import type { SavedProfile } from "@/lib/profiles";

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

// Separate from the localStorage PWA offline cache above: this survives a
// client-side route change within the same browser tab (e.g. switching
// language, which navigates from /en/pancha-pakshi to /si/pancha-pakshi and
// remounts this page under the new [locale] segment, wiping normal React
// state) but not a new tab/session — so a restore from here is genuinely
// still-live data, never mislabeled as offline/stale. Holds only the
// computed schedule response, never the birth-data request that produced it.
const SESSION_SCHEDULE_KEY = "ff_session_schedule";

type SessionSchedule = { schedule: ScheduleResponse; serverTimeIso: string | null; fetchedAtClientMs: number };

function loadSessionSchedule(): SessionSchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_SCHEDULE_KEY);
    return raw ? (JSON.parse(raw) as SessionSchedule) : null;
  } catch {
    return null;
  }
}

function saveSessionSchedule(schedule: ScheduleResponse, serverTime: Date | null, fetchedAtClientMs: number) {
  window.sessionStorage.setItem(
    SESSION_SCHEDULE_KEY,
    JSON.stringify({
      schedule,
      serverTimeIso: serverTime ? serverTime.toISOString() : null,
      fetchedAtClientMs,
    } satisfies SessionSchedule),
  );
}

export function PanchaPakshiClient() {
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

  useEffect(() => {
    // Restores a schedule lost to the remount that happens when switching
    // language (the locale segment changing navigates to a new pathname,
    // which unmounts this page). Same-tab-session only, so this never
    // resurrects genuinely old data across a new visit — see
    // loadSessionSchedule's comment.
    const restored = loadSessionSchedule();
    if (restored) {
      /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration
         from sessionStorage on mount, same pattern as the isOnline effect
         above; there's no "external system" to subscribe to here instead. */
      setSchedule(restored.schedule);
      setServerTime(restored.serverTimeIso ? new Date(restored.serverTimeIso) : null);
      setFetchedAtClientMs(restored.fetchedAtClientMs);
      setIsStale(false);
      setCachedAtIso(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  const runSchedule = useCallback(async (request: ScheduleRequest) => {
    setLastRequest(request);
    setLoading(true);
    setError(null);
    try {
      const { data, serverTime: st } = await fetchScheduleWithServerTime(request);
      const fetchedAtMs = Date.now();
      setSchedule(data);
      setServerTime(st);
      setFetchedAtClientMs(fetchedAtMs);
      setIsStale(false);
      setCachedAtIso(null);
      saveCachedSchedule(data);
      saveSessionSchedule(data, st, fetchedAtMs);
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

  // The identity of the current result, offered as "save as profile". Only
  // the derived bird (or the entered nakshatra+paksha) is kept — a result
  // computed from full birth details deliberately saves just the bird.
  const saveCandidate: Omit<SavedProfile, "id" | "created_at" | "label"> | null =
    schedule && lastRequest
      ? lastRequest.method === "nakshatra_paksha"
        ? {
            bird: null,
            nakshatra_index: lastRequest.nakshatra_index,
            paksha: lastRequest.paksha,
          }
        : { bird: schedule.birth_bird, nakshatra_index: null, paksha: null }
      : null;

  const scheduleFromProfile = useCallback(
    (profile: SavedProfile) => {
      const location = mostRecentLocation() ?? DEFAULT_LOCATION;
      const target = nowAsTargetDateTime();
      const base = {
        target_date: target.date,
        target_time: target.time,
        location_name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        iana_tz: location.iana_tz,
      };
      if (profile.bird) {
        runSchedule({ ...base, method: "bird", bird: profile.bird });
      } else if (profile.nakshatra_index && profile.paksha) {
        runSchedule({
          ...base,
          method: "nakshatra_paksha",
          nakshatra_index: profile.nakshatra_index,
          paksha: profile.paksha,
        });
      }
    },
    [runSchedule],
  );

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

      <SavedProfiles onPick={scheduleFromProfile} saveCandidate={saveCandidate} />

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

      {error && (
        <div
          role="alert"
          className="flex flex-col items-start gap-2 rounded-xl border border-red-600/30 bg-red-600/5 p-4"
        >
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">{dict.ui.errorTitle}</p>
          <p className="text-sm opacity-80">{error}</p>
          {lastRequest && (
            <button
              type="button"
              onClick={refetch}
              className="rounded-full border border-red-600/40 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-600/10 dark:text-red-400"
            >
              {dict.ui.retry}
            </button>
          )}
        </div>
      )}
      {loading && <ScheduleSkeleton />}

      <section
        key={method}
        role="tabpanel"
        className="animate-panel-in rounded-xl border border-black/10 p-6 dark:border-white/10"
      >
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { listLocalProfiles, type SavedProfile } from "@/lib/profiles";
import { BestWindows } from "@/components/pancha-pakshi/BestWindows";
import { DateNav } from "@/components/pancha-pakshi/DateNav";
import { Legend } from "@/components/pancha-pakshi/Legend";
import { StickyCurrentBar } from "@/components/pancha-pakshi/StickyCurrentBar";
import type { BirdId } from "@/lib/api-client";

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
  const [usedDefaults, setUsedDefaults] = useState(false);
  const countdownCardRef = useRef<HTMLDivElement>(null);

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
      let { data, serverTime: st } = await fetchScheduleWithServerTime(request);
      let fetchedAtMs = Date.now();
      // A tab left open past next_sunrise would otherwise freeze: the
      // refetch replays the original target date, the server correctly says
      // "nothing in that window is current anymore" (current_period null),
      // and the countdown shows loading forever. When that happens, roll the
      // request forward to now — a single follow-up fetch, not recursion, so
      // a still-null response can't loop.
      const referenceNow = st ? st.getTime() : fetchedAtMs;
      if (data.current_period === null && new Date(data.next_sunrise).getTime() <= referenceNow) {
        const now = new Date(referenceNow);
        const pad = (n: number) => String(n).padStart(2, "0");
        const rolled: ScheduleRequest = {
          ...request,
          target_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
          target_time: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        };
        setLastRequest(rolled);
        ({ data, serverTime: st } = await fetchScheduleWithServerTime(rolled));
        fetchedAtMs = Date.now();
      }
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
      return;
    }
    // Zero-click first result: nothing restored, so compute immediately from
    // the best available default — the newest saved profile, else the last
    // explicitly selected bird, else the platform default (peacock) — at the
    // most recent location (else Colombo). The forms stay fully usable while
    // this loads; the notice under the result offers the change affordance.
    if (navigator.onLine === false) return;
    const localProfiles = listLocalProfiles();
    const newest = localProfiles[localProfiles.length - 1];
    const storedBird = window.localStorage.getItem("ff_selected_bird") as BirdId | null;
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
    setUsedDefaults(true);
    if (newest?.bird) {
      void runSchedule({ ...base, method: "bird", bird: newest.bird });
    } else if (newest?.nakshatra_index && newest?.paksha) {
      void runSchedule({
        ...base,
        method: "nakshatra_paksha",
        nakshatra_index: newest.nakshatra_index,
        paksha: newest.paksha,
      });
    } else {
      void runSchedule({ ...base, method: "bird", bird: storedBird ?? "peacock" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = useCallback(() => {
    if (lastRequest && isOnline) runSchedule(lastRequest);
  }, [lastRequest, isOnline, runSchedule]);

  // Explicit user submissions (forms, profile chips) clear the "showing
  // defaults" notice and remember a directly-chosen bird for next visit's
  // zero-click default.
  const runUserSchedule = useCallback(
    (request: ScheduleRequest) => {
      setUsedDefaults(false);
      if (request.method === "bird") {
        window.localStorage.setItem("ff_selected_bird", request.bird);
      }
      void runSchedule(request);
    },
    [runSchedule],
  );

  const changeDate = useCallback(
    (date: string) => {
      if (!lastRequest) return;
      void runSchedule({ ...lastRequest, target_date: date });
    },
    [lastRequest, runSchedule],
  );

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
        runUserSchedule({ ...base, method: "bird", bird: profile.bird });
      } else if (profile.nakshatra_index && profile.paksha) {
        runUserSchedule({
          ...base,
          method: "nakshatra_paksha",
          nakshatra_index: profile.nakshatra_index,
          paksha: profile.paksha,
        });
      }
    },
    [runUserSchedule],
  );

  const skewMs = serverTime ? serverTime.getTime() - fetchedAtClientMs : 0;
  const displayedDate =
    lastRequest?.target_date ?? (schedule ? schedule.sunrise.slice(0, 10) : nowAsTargetDateTime().date);
  // The countdown is only meaningful when the displayed sunrise-to-sunrise
  // window actually contains "now" — comparing calendar dates would misfire
  // around the before-sunrise rollback, so compare against the window itself.
  // Render-pure "now": the (skew-corrected) moment of the last fetch. The
  // countdown's own boundary refetch refreshes fetchedAtClientMs whenever a
  // period rolls over, so this stays accurate without reading Date.now()
  // during render.
  const nowAtFetch = fetchedAtClientMs + skewMs;
  const windowContainsNow = schedule
    ? nowAtFetch >= new Date(schedule.sunrise).getTime() &&
      nowAtFetch < new Date(schedule.next_sunrise).getTime()
    : true;

  const scrollToMajor = useCallback((majorIndex: number) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`major-period-${majorIndex}`)
      ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }, []);

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
          {usedDefaults && !isStale && (
            <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs">
              {dict.ui.showingFor}: {translateEnum(dict, "birds", schedule.birth_bird)} ·{" "}
              {schedule.location.name} — {dict.ui.defaultsNotice}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DateNav date={displayedDate} onChange={changeDate} />
            {!windowContainsNow && (
              <button
                type="button"
                onClick={() => changeDate(nowAsTargetDateTime().date)}
                className="rounded-lg border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
              >
                {dict.ui.backToToday}
              </button>
            )}
          </div>
          {windowContainsNow ? (
            <div ref={countdownCardRef}>
              <LiveCountdown
                current={schedule.current_period}
                next={schedule.next_period}
                serverTime={serverTime}
                fetchedAtClientMs={fetchedAtClientMs}
                onExpire={refetch}
                isStale={isStale}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-black/10 px-3 py-2 text-sm opacity-80 dark:border-white/10">
              {dict.ui.viewingAnotherDay}
            </p>
          )}
          <StickyCurrentBar
            current={windowContainsNow ? schedule.current_period : null}
            skewMs={skewMs}
            watchRef={countdownCardRef}
          />
          <BestWindows schedule={schedule} skewMs={skewMs} onSelect={scrollToMajor} />
          <Legend />
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
          <ScheduleTimeline
            schedule={schedule}
            skewMs={skewMs}
            weekRequest={lastRequest ?? undefined}
            onPickDay={changeDate}
          />
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
        {method === "birth_datetime" && <BirthInputForm onSubmit={runUserSchedule} />}
        {method === "nakshatra_paksha" && <NakshatraPakshaForm onSubmit={runUserSchedule} />}
        {method === "bird" && <BirdSelector onSubmit={runUserSchedule} />}
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

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { resolveKey, translateEnum } from "@/lib/i18n";
import { features } from "@/lib/feature-registry";
import { ApiError, type ScheduleRequest, type ScheduleResponse } from "@/lib/api-client";
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
import { BestWindows } from "@/components/pancha-pakshi/BestWindows";
import { NotificationOptIn } from "@/components/pancha-pakshi/NotificationOptIn";
import { DateNav } from "@/components/pancha-pakshi/DateNav";
import { ExportControls } from "@/components/pancha-pakshi/ExportControls";
import { EFFECT_COLORS } from "@fernandofamily/design-system";
import { PrintSheet, type ExportDetail } from "@/components/pancha-pakshi/PrintSheet";
import { Legend } from "@/components/pancha-pakshi/Legend";
import { StickyCurrentBar } from "@/components/pancha-pakshi/StickyCurrentBar";
import {
  fetchLiveSchedule,
  hasDerivedIdentitySeed,
  loadCachedSchedule,
  loadSessionSchedule,
  resolveDefaultScheduleRequest,
  saveCachedSchedule,
  saveLiveSeed,
  saveSessionSchedule,
} from "@/lib/pancha-schedule-state";

type Method = "birth_datetime" | "nakshatra_paksha" | "bird";

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
  const [exportDetail, setExportDetail] = useState<ExportDetail>("full");
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
      const { data, serverTime: st, fetchedAtClientMs: fetchedAtMs, request: finalRequest } = await fetchLiveSchedule(request);
      setLastRequest(finalRequest);
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
    const restored = hasDerivedIdentitySeed() ? null : loadSessionSchedule();
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
    // the best available default — account default bird, newest saved
    // profile, last explicitly selected bird, else the platform default
    // (peacock) — at the account default location, most recent local
    // location, else Colombo. The forms stay fully usable while this loads;
    // the notice under the result offers the change affordance.
    if (navigator.onLine === false) return;
    let cancelled = false;
    (async () => {
      const request = await resolveDefaultScheduleRequest();
      if (cancelled) return;
      setUsedDefaults(true);
      void runSchedule(request);
    })();
    return () => {
      cancelled = true;
    };
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
      const target = nowAsTargetDateTime(location.iana_tz);
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

  const renderScheduleSettings = () => (
    <ScheduleSettings
      method={method}
      setMethod={setMethod}
      tabs={tabs}
      error={error}
      loading={loading}
      lastRequest={lastRequest}
      refetch={refetch}
      runUserSchedule={runUserSchedule}
      scheduleFromProfile={scheduleFromProfile}
      saveCandidate={saveCandidate}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold">{resolveKey(dict, feature.titleKey)}</h1>
        <p className="mt-1 text-sm opacity-80 sm:text-base">{resolveKey(dict, feature.descriptionKey)}</p>
      </header>

      {!isOnline && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {dict.ui.offlineCachedNotice}
        </p>
      )}

      <div className={schedule ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start" : "flex flex-col gap-6"}>
        <section className="flex min-w-0 flex-col gap-5">
          {schedule ? (
            <>
              {isStale && cachedAtIso && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
                  {dict.ui.offlineCachedNotice} — {dict.ui.generatedAt}:{" "}
                  {new Date(cachedAtIso).toLocaleString(locale === "si" ? "si-LK" : "en-US")} ·{" "}
                  {schedule.location.name}
                </p>
              )}
              {usedDefaults && !isStale && (
                <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs">
                  {dict.ui.showingFor}: {translateEnum(dict, "birds", schedule.birth_bird)} ·{" "}
                  {schedule.location.name} — {dict.ui.defaultsNotice}
                </p>
              )}
              {schedule.chandrashtama && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  <span className="font-semibold">{dict.ui.chandrashtama}</span> —{" "}
                  {locale === "si"
                    ? `${new Date(schedule.chandrashtama.ends_at).toLocaleTimeString()} ${dict.ui.chandrashtamaUntil}`
                    : `${dict.ui.chandrashtamaUntil} ${new Date(schedule.chandrashtama.ends_at).toLocaleTimeString()}`}
                </p>
              )}

              <section className="rounded-xl border border-black/10 bg-white/35 p-3 shadow-sm dark:border-white/10 dark:bg-white/[.03] sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DateNav date={displayedDate} onChange={changeDate} />
                  <div className="flex flex-wrap items-center gap-2">
                    {!windowContainsNow && (
                      <button
                        type="button"
                        onClick={() => changeDate(nowAsTargetDateTime(schedule.location.iana_tz).date)}
                        className="rounded-lg border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                      >
                        {dict.ui.backToToday}
                      </button>
                    )}
                    <Link
                      href={`/${locale}/pancha-pakshi/live`}
                      onClick={() => saveLiveSeed(schedule, serverTime, fetchedAtClientMs)}
                      className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                    >
                      {dict.ui.liveView}
                    </Link>
                  </div>
                </div>
                <div className="mt-3">
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
                </div>
              </section>

              <StickyCurrentBar
                current={windowContainsNow ? schedule.current_period : null}
                skewMs={skewMs}
                watchRef={countdownCardRef}
              />

              <details
                className="rounded-xl border border-black/10 bg-white/30 p-3 dark:border-white/10 dark:bg-white/[.03] lg:hidden"
                data-testid="change-details-panel"
              >
                <summary className="cursor-pointer text-sm font-semibold text-accent">{dict.ui.changeDetails}</summary>
                <div className="mt-3">{renderScheduleSettings()}</div>
              </details>

              <BestWindows schedule={schedule} skewMs={skewMs} onSelect={scrollToMajor} />
              <ScheduleTimeline
                schedule={schedule}
                skewMs={skewMs}
                weekRequest={lastRequest ?? undefined}
                onPickDay={changeDate}
              />

              <details
                className="rounded-xl border border-black/10 bg-white/30 p-4 dark:border-white/10 dark:bg-white/[.03]"
                data-testid="tools-context-panel"
              >
                <summary className="cursor-pointer text-sm font-semibold text-accent">{dict.ui.toolsAndContext}</summary>
                <div className="mt-4 flex flex-col gap-4">
                  <ExportControls
                    schedule={schedule}
                    lastRequest={lastRequest}
                    detail={exportDetail}
                    onDetailChange={setExportDetail}
                  />
                  <NotificationOptIn
                    bird={lastRequest?.method === "nakshatra_paksha" ? null : schedule.birth_bird}
                    nakshatraIndex={
                      lastRequest?.method === "nakshatra_paksha" ? lastRequest.nakshatra_index : null
                    }
                    paksha={lastRequest?.method === "nakshatra_paksha" ? lastRequest.paksha : null}
                    latitude={schedule.location.latitude}
                    longitude={schedule.location.longitude}
                    ianaTz={schedule.location.iana_tz}
                  />
                  <Legend />
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-black/10 p-4 text-sm dark:border-white/10 sm:grid-cols-4">
                    <Fact label={dict.ui.location} value={schedule.location.name} />
                    <Fact label={dict.ui.weekday} value={translateEnum(dict, "weekdays", schedule.weekday)} />
                    <Fact
                      label={dict.ui.dishaShool}
                      value={translateEnum(dict, "directions", schedule.disha_shool)}
                    />
                    <Fact label={dict.ui.paksha} value={translateEnum(dict, "paksha", schedule.paksha)} />
                    <Fact label={dict.ui.birthBird} value={translateEnum(dict, "birds", schedule.birth_bird)} />
                    {schedule.tara_bala && (
                      <Fact
                        label={dict.ui.taraBala}
                        value={`${translateEnum(dict, "taraCategories", schedule.tara_bala.key)} — ${translateEnum(dict, "effects", schedule.tara_bala.effect)}`}
                        color={EFFECT_COLORS[schedule.tara_bala.effect]}
                      />
                    )}
                    <Fact label={dict.ui.sunrise} value={new Date(schedule.sunrise).toLocaleTimeString()} />
                    <Fact label={dict.ui.sunset} value={new Date(schedule.sunset).toLocaleTimeString()} />
                    <Fact label={dict.ui.nextSunrise} value={new Date(schedule.next_sunrise).toLocaleTimeString()} />
                    <Fact label={dict.ui.paduPakshi} value={translateEnum(dict, "birds", schedule.padu_pakshi)} />
                  </div>
                </div>
              </details>
              <PrintSheet schedule={schedule} detail={exportDetail} />
            </>
          ) : null}
        </section>

        <aside
          className={schedule ? "hidden lg:sticky lg:top-4 lg:block" : ""}
          data-testid="schedule-settings-panel"
        >
          {renderScheduleSettings()}
        </aside>
      </div>
    </div>
  );
}

function ScheduleSettings({
  method,
  setMethod,
  tabs,
  error,
  loading,
  lastRequest,
  refetch,
  runUserSchedule,
  scheduleFromProfile,
  saveCandidate,
}: {
  method: Method;
  setMethod: (method: Method) => void;
  tabs: { id: Method; label: string }[];
  error: string | null;
  loading: boolean;
  lastRequest: ScheduleRequest | null;
  refetch: () => void;
  runUserSchedule: (request: ScheduleRequest) => void;
  scheduleFromProfile: (profile: SavedProfile) => void;
  saveCandidate: Omit<SavedProfile, "id" | "created_at" | "label"> | null;
}) {
  const { dict } = useLocale();

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white/45 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">{dict.ui.scheduleSettings}</h2>
      <SavedProfiles onPick={scheduleFromProfile} saveCandidate={saveCandidate} />

      <div
        role="tablist"
        aria-label={dict.ui.birthDetails}
        className="-mx-1 flex gap-2 overflow-x-auto border-b border-black/10 px-1 dark:border-white/10"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={method === tab.id}
            onClick={() => setMethod(tab.id)}
            className={`whitespace-nowrap px-3 py-2 text-sm ${
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
          className="flex flex-col items-start gap-2 rounded-lg border border-red-600/30 bg-red-600/5 p-4"
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
        className="animate-panel-in rounded-lg border border-black/10 p-4 dark:border-white/10"
      >
        {method === "birth_datetime" && <BirthInputForm onSubmit={runUserSchedule} />}
        {method === "nakshatra_paksha" && <NakshatraPakshaForm onSubmit={runUserSchedule} />}
        {method === "bird" && <BirdSelector onSubmit={runUserSchedule} />}
      </section>
    </section>
  );
}

function Fact({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase opacity-60">{label}</span>
      <span className="font-medium" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

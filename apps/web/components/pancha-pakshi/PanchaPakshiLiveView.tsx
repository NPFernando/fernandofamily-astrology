"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type ScheduleRequest, type ScheduleResponse, type SubPeriod } from "@/lib/api-client";
import { translateEnum } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";
import {
  fetchLiveSchedule,
  loadCachedSchedule,
  loadLiveSeed,
  requestFromSchedule,
  resolveDefaultScheduleRequest,
  saveCachedSchedule,
  saveLiveSeed,
  saveSessionSchedule,
} from "@/lib/pancha-schedule-state";
import { subPeriodGuidance } from "@/lib/pancha-guidance";
import { BIRD_ICONS } from "@/components/icons/birds";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { ACTIVITY_COLORS } from "@/components/pancha-pakshi/activityColors";
import { EFFECT_COLORS } from "@fernandofamily/design-system";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function pct(startMs: number, valueMs: number, totalMs: number) {
  return ((valueMs - startMs) / totalMs) * 100;
}

export function PanchaPakshiLiveView() {
  const { dict, locale } = useLocale();
  const [lastRequest, setLastRequest] = useState<ScheduleRequest | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [serverTime, setServerTime] = useState<Date | null>(null);
  const [fetchedAtClientMs, setFetchedAtClientMs] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [cachedAtIso, setCachedAtIso] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    document.body.classList.add("pancha-live-active");
    return () => document.body.classList.remove("pancha-live-active");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate browser online state after SSR.
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

  const runSchedule = useCallback(
    async (request: ScheduleRequest) => {
      setLastRequest(request);
      setLoading(true);
      setError(null);
      try {
        const result = await fetchLiveSchedule(request);
        setLastRequest(result.request);
        setSchedule(result.data);
        setServerTime(result.serverTime);
        setFetchedAtClientMs(result.fetchedAtClientMs);
        setNow(Date.now() + (result.serverTime ? result.serverTime.getTime() - result.fetchedAtClientMs : 0));
        setIsStale(false);
        setCachedAtIso(null);
        saveCachedSchedule(result.data);
        saveSessionSchedule(result.data, result.serverTime, result.fetchedAtClientMs);
        saveLiveSeed(result.data, result.serverTime, result.fetchedAtClientMs);
      } catch (e) {
        const cached = loadCachedSchedule();
        if (cached) {
          setSchedule(cached.schedule);
          setLastRequest(requestFromSchedule(cached.schedule));
          setServerTime(null);
          setFetchedAtClientMs(Date.now());
          setNow(Date.now());
          setIsStale(true);
          setCachedAtIso(cached.cachedAtIso);
        } else {
          setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
        }
      } finally {
        setLoading(false);
      }
    },
    [dict.ui.error],
  );

  const refetch = useCallback(() => {
    const request = schedule ? requestFromSchedule(schedule) : lastRequest;
    if (request && isOnline) void runSchedule(request);
  }, [isOnline, lastRequest, runSchedule, schedule]);

  useEffect(() => {
    const seed = loadLiveSeed();
    if (seed) {
      /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from sessionStorage. */
      setSchedule(seed.schedule);
      setLastRequest(seed.request);
      setServerTime(seed.serverTimeIso ? new Date(seed.serverTimeIso) : null);
      setFetchedAtClientMs(seed.fetchedAtClientMs);
      setIsStale(false);
      setCachedAtIso(null);
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      if (navigator.onLine !== false) void runSchedule(seed.request);
      return;
    }

    if (navigator.onLine === false) {
      const cached = loadCachedSchedule();
      if (cached) {
        setSchedule(cached.schedule);
        setLastRequest(requestFromSchedule(cached.schedule));
        setServerTime(null);
        setFetchedAtClientMs(Date.now());
        setIsStale(true);
        setCachedAtIso(cached.cachedAtIso);
        setLoading(false);
      } else {
        setLoading(false);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const request = await resolveDefaultScheduleRequest();
      if (!cancelled) void runSchedule(request);
    })();
    return () => {
      cancelled = true;
    };
  }, [runSchedule]);

  const skewMs = serverTime ? serverTime.getTime() - fetchedAtClientMs : 0;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now() + skewMs), 1000);
    return () => window.clearInterval(interval);
  }, [skewMs]);

  useEffect(() => {
    expiredRef.current = false;
  }, [schedule?.current_period?.id]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") refetch();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", refetch);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", refetch);
    };
  }, [refetch]);

  const current = schedule?.current_period ?? null;
  const remainingMs = current ? new Date(current.ends_at).getTime() - now : null;

  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && !expiredRef.current && !isStale && !loading) {
      expiredRef.current = true;
      refetch();
    }
  }, [isStale, loading, refetch, remainingMs]);

  const timeFormat = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateFormat = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section
      data-testid="ambient-live-view"
      className="fixed inset-0 z-50 min-h-dvh overflow-y-auto bg-background text-foreground"
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
          <div>
            <p className="text-xs font-semibold uppercase text-accent">{dict.ui.ambientLiveView}</p>
            <h1 className="text-xl font-bold sm:text-2xl">{dict.metadata.panchaPakshiLive.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refetch}
              disabled={!isOnline || loading}
              className="rounded-lg border border-accent/40 px-3 py-2 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dict.ui.retry}
            </button>
            <Link
              href={`/${locale}/pancha-pakshi`}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"
            >
              {dict.ui.exitLiveView}
            </Link>
          </div>
        </header>

        {(isStale || !isOnline) && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium">
            {dict.ui.offlineCachedNotice}
            {cachedAtIso
              ? ` ${dict.ui.generatedAt}: ${new Date(cachedAtIso).toLocaleString(locale === "si" ? "si-LK" : "en-US")}`
              : ""}
          </p>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-red-600/30 bg-red-600/5 p-4">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">{dict.ui.errorTitle}</p>
            <p className="mt-1 text-sm opacity-80">{error}</p>
          </div>
        )}

        {!schedule || !current ? (
          <div className="flex min-h-[55dvh] items-center justify-center">
            <p className="text-sm opacity-70">{loading ? dict.ui.loading : dict.ui.liveViewNoCurrent}</p>
          </div>
        ) : (
          <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)] lg:items-stretch">
            <section className="flex min-w-0 flex-col justify-between rounded-xl border border-black/10 bg-white/35 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.03] sm:p-6">
              <LiveCurrentPanel
                current={current}
                next={schedule.next_period}
                remainingMs={remainingMs ?? 0}
                isStale={isStale}
              />
              <LiveDayProgressBar schedule={schedule} nowMs={now} />
            </section>

            <aside className="grid min-w-0 gap-4 lg:grid-rows-[auto_1fr]">
              <section className="rounded-xl border border-black/10 bg-white/35 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.03]">
                <h2 className="text-xs font-semibold uppercase text-accent">{dict.ui.liveViewStatus}</h2>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Fact label={dict.ui.location} value={schedule.location.name} />
                  <Fact
                    label={dict.ui.birthBird}
                    value={translateEnum(dict, "birds", schedule.birth_bird)}
                    testId="live-birth-bird"
                  />
                  {schedule.tara_bala && (
                    <Fact
                      label={dict.ui.taraBala}
                      value={`${translateEnum(dict, "taraCategories", schedule.tara_bala.key)} — ${translateEnum(dict, "effects", schedule.tara_bala.effect)}`}
                      color={EFFECT_COLORS[schedule.tara_bala.effect]}
                    />
                  )}
                  {schedule.chandrashtama && (
                    <Fact
                      label={dict.ui.chandrashtama}
                      value={
                        locale === "si"
                          ? `${timeFormat.format(new Date(schedule.chandrashtama.ends_at))} ${dict.ui.chandrashtamaUntil}`
                          : `${dict.ui.chandrashtamaUntil} ${timeFormat.format(new Date(schedule.chandrashtama.ends_at))}`
                      }
                      color={EFFECT_COLORS.bad}
                    />
                  )}
                  <Fact label={dict.ui.weekday} value={translateEnum(dict, "weekdays", schedule.weekday)} />
                  <Fact
                    label={dict.ui.dishaShool}
                    value={translateEnum(dict, "directions", schedule.disha_shool)}
                  />
                  <Fact label={dict.ui.paksha} value={translateEnum(dict, "paksha", schedule.paksha)} />
                  <Fact label={dict.ui.sunrise} value={timeFormat.format(new Date(schedule.sunrise))} />
                  <Fact label={dict.ui.sunset} value={timeFormat.format(new Date(schedule.sunset))} />
                </dl>
                <p className="mt-4 text-xs opacity-70">
                  {dateFormat.format(new Date(schedule.sunrise))} · {dict.ui.nextSunrise}{" "}
                  {timeFormat.format(new Date(schedule.next_sunrise))}
                </p>
              </section>

              <LiveGuidancePanel current={current} />
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function LiveCurrentPanel({
  current,
  next,
  remainingMs,
  isStale,
}: {
  current: SubPeriod;
  next: SubPeriod | null;
  remainingMs: number;
  isStale: boolean;
}) {
  const { dict, locale } = useLocale();
  const MainBirdIcon = BIRD_ICONS[current.main_bird];
  const MainActivityIcon = ACTIVITY_ICONS[current.main_activity];
  const SubBirdIcon = BIRD_ICONS[current.sub_bird];
  const SubActivityIcon = ACTIVITY_ICONS[current.sub_activity];
  const inFinalMinute = remainingMs > 0 && remainingMs <= 60_000 && !isStale;
  const timeFormat = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div key={current.id} className="animate-period-change flex min-w-0 flex-1 flex-col justify-center gap-6">
      <div>
        <p className="text-sm font-semibold uppercase text-accent">{dict.ui.timeRemaining}</p>
        <p
          className={`mt-2 break-words text-6xl font-bold tabular-nums text-accent sm:text-8xl lg:text-9xl ${
            inFinalMinute ? "animate-final-minute" : ""
          }`}
        >
          {formatDuration(remainingMs)}
        </p>
        <p className="mt-2 text-sm opacity-70">
          {dict.ui.endsAt} {timeFormat.format(new Date(current.ends_at))}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LiveMetric
          label={dict.ui.mainBird}
          icon={<MainBirdIcon className="text-3xl" />}
          title={translateEnum(dict, "birds", current.main_bird)}
          detail={translateEnum(dict, "activities", current.main_activity)}
          activityIcon={<MainActivityIcon className="text-2xl" style={{ color: ACTIVITY_COLORS[current.main_activity] }} />}
        />
        <LiveMetric
          label={dict.ui.subBird}
          icon={<SubBirdIcon className="text-3xl" />}
          title={translateEnum(dict, "birds", current.sub_bird)}
          detail={translateEnum(dict, "activities", current.sub_activity)}
          activityIcon={<SubActivityIcon className="text-2xl" style={{ color: ACTIVITY_COLORS[current.sub_activity] }} />}
        />
      </div>

      {next && (
        <p className="rounded-lg border border-black/10 bg-background/55 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[.04]">
          <span className="font-semibold text-accent">{dict.ui.nextPeriod}:</span>{" "}
          {translateEnum(dict, "birds", next.sub_bird)} · {translateEnum(dict, "activities", next.sub_activity)} ·{" "}
          {timeFormat.format(new Date(next.starts_at))}
        </p>
      )}
    </div>
  );
}

function LiveMetric({
  label,
  icon,
  title,
  detail,
  activityIcon,
}: {
  label: string;
  icon: ReactNode;
  title: string;
  detail: string;
  activityIcon: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-black/10 bg-background/65 p-3 dark:border-white/10 dark:bg-white/[.04]">
      <p className="text-xs font-semibold uppercase opacity-60">{label}</p>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-accent">{icon}</span>
        <p className="min-w-0 text-xl font-semibold">{title}</p>
      </div>
      <p className="mt-2 flex min-w-0 items-center gap-2 text-sm opacity-80">
        <span className="shrink-0">{activityIcon}</span>
        <span className="min-w-0">{detail}</span>
      </p>
    </div>
  );
}

function LiveGuidancePanel({ current }: { current: SubPeriod }) {
  const { dict } = useLocale();
  const guidance = subPeriodGuidance(dict, current);
  return (
    <section className="rounded-xl border border-black/10 bg-white/35 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.03]">
      <h2 className="text-xs font-semibold uppercase text-accent">{guidance.title}</h2>
      <p className="mt-3 text-sm leading-relaxed opacity-90">{guidance.activity}</p>
      <p className="mt-3 text-sm leading-relaxed opacity-80">{guidance.effect}</p>
      <p className="mt-4 text-xs leading-relaxed opacity-60">{guidance.disclaimer}</p>
    </section>
  );
}

function LiveDayProgressBar({ schedule, nowMs }: { schedule: ScheduleResponse; nowMs: number }) {
  const { dict, locale } = useLocale();
  const startMs = new Date(schedule.sunrise).getTime();
  const sunsetMs = new Date(schedule.sunset).getTime();
  const endMs = new Date(schedule.next_sunrise).getTime();
  const totalMs = endMs - startMs;
  if (totalMs <= 0) return null;
  const dayPct = pct(startMs, sunsetMs, totalMs);
  const nowPct = nowMs >= startMs && nowMs < endMs ? pct(startMs, nowMs, totalMs) : null;
  const timeFormat = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mt-6 print:hidden">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase opacity-70">
        <span>{dict.ui.dayTimelineBar}</span>
        <span>{dict.ui.now}</span>
      </div>
      <div role="group" aria-label={dict.ui.dayTimelineBar} className="relative h-8 overflow-hidden rounded-lg">
        <div aria-hidden className="absolute inset-0 flex">
          <div style={{ width: `${dayPct}%` }} className="bg-amber-200/60 dark:bg-amber-500/15" />
          <div style={{ width: `${100 - dayPct}%` }} className="bg-indigo-950/15 dark:bg-indigo-400/10" />
        </div>
        <div className="absolute inset-0 flex">
          {schedule.major_periods.flatMap((major) =>
            major.sub_periods.map((sp) => {
              const w = pct(new Date(sp.starts_at).getTime(), new Date(sp.ends_at).getTime(), totalMs);
              return (
                <span
                  key={sp.id}
                  style={{ width: `${w}%`, backgroundColor: ACTIVITY_COLORS[sp.sub_activity] }}
                  className={sp.is_current ? "h-full opacity-95 ring-2 ring-white dark:ring-white/80" : "h-full opacity-55"}
                />
              );
            }),
          )}
        </div>
        {nowPct !== null && (
          <div
            aria-hidden
            style={{ left: `${nowPct}%` }}
            className="now-marker pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-foreground"
          />
        )}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] opacity-70">
        <span>
          {dict.ui.sunrise} {timeFormat.format(new Date(schedule.sunrise))}
        </span>
        <span className="text-center">
          {dict.ui.sunset} {timeFormat.format(new Date(schedule.sunset))}
        </span>
        <span className="text-right">
          {dict.ui.nextSunrise} {timeFormat.format(new Date(schedule.next_sunrise))}
        </span>
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  testId,
  color,
}: {
  label: string;
  value: string;
  testId?: string;
  color?: string;
}) {
  return (
    <div data-testid={testId} className="min-w-0">
      <dt className="text-xs uppercase opacity-60">{label}</dt>
      <dd className="mt-1 break-words font-medium" style={color ? { color } : undefined}>
        {value}
      </dd>
    </div>
  );
}

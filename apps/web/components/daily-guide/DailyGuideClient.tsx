"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { getDictionary, NAKSHATRAS, nakshatraName, translateEnum } from "@/lib/i18n";
import {
  ApiError,
  fetchPanchanga,
  fetchScheduleWithServerTime,
  type BirdId,
  type DailyPanchanga,
  type EffectId,
  type PakshaId,
  type ScheduleRequest,
  type ScheduleResponse,
  type SubPeriod,
} from "@/lib/api-client";
import { DateNav } from "@/components/pancha-pakshi/DateNav";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { resolveDefaultScheduleRequest } from "@/lib/pancha-schedule-state";
import { SavedProfiles } from "@/components/pancha-pakshi/SavedProfiles";
import type { SavedProfile } from "@/lib/profiles";
import { BIRD_ICONS } from "@/components/icons/birds";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { ACTIVITY_COLORS } from "@/components/pancha-pakshi/activityColors";
import { SunIcon } from "@/components/icons/sun";
import { FullMoonIcon } from "@/components/icons/moon";
import { activityGuidance } from "@/lib/pancha-guidance";
import { EFFECT_COLORS } from "@fernandofamily/design-system";

const BIRDS: BirdId[] = ["vulture", "owl", "crow", "cock", "peacock"];
const EFFECT_RANK: Record<EffectId, number> = {
  very_good: 0,
  good: 1,
  average: 2,
  bad: 3,
  very_bad: 4,
};

type GuideData = {
  panchanga: DailyPanchanga;
  schedule: ScheduleResponse;
  serverTime: Date | null;
  fetchedAtClientMs: number;
};

function sinhalaMonthName(dict: ReturnType<typeof getDictionary>, key: string): string {
  const isAdhi = key.startsWith("adhi-");
  const baseKey = isAdhi ? key.slice(5) : key;
  const baseName = translateEnum(dict, "sinhalaMonths", baseKey);
  return isAdhi ? `${dict.panchanga.adhiPrefix} ${baseName}` : baseName;
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(isoDate: string, locale: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function todayFor(location: LocationValue): { date: string; time: string } {
  return nowAsTargetDateTime(location.iana_tz);
}

function targetTimeFor(date: string, location: LocationValue): string {
  const nowThere = todayFor(location);
  return date === nowThere.date ? nowThere.time : "12:00:00";
}

function locationFromRequest(request: ScheduleRequest): LocationValue {
  return {
    name: request.location_name,
    latitude: request.latitude,
    longitude: request.longitude,
    iana_tz: request.iana_tz,
  };
}

function withDateLocation(request: ScheduleRequest, date: string, location: LocationValue): ScheduleRequest {
  const base = {
    target_date: date,
    target_time: targetTimeFor(date, location),
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
  };
  if (request.method === "nakshatra_paksha") {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: request.nakshatra_index,
      paksha: request.paksha,
    };
  }
  if (request.method === "birth_datetime") {
    return {
      ...base,
      method: "birth_datetime",
      birth_date: request.birth_date,
      birth_time: request.birth_time,
    };
  }
  return { ...base, method: "bird", bird: request.bird };
}

function requestFromProfile(profile: SavedProfile, date: string, location: LocationValue): ScheduleRequest | null {
  const base = {
    target_date: date,
    target_time: targetTimeFor(date, location),
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
  };
  if (profile.bird) return { ...base, method: "bird", bird: profile.bird };
  if (profile.nakshatra_index && profile.paksha) {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: profile.nakshatra_index,
      paksha: profile.paksha,
    };
  }
  return null;
}

function bestWindows(schedule: ScheduleResponse): SubPeriod[] {
  return schedule.major_periods
    .flatMap((m) => m.sub_periods)
    .filter((sp) => sp.effect === "good" || sp.effect === "very_good")
    .sort((a, b) => {
      const effectRank = EFFECT_RANK[a.effect] - EFFECT_RANK[b.effect];
      if (effectRank !== 0) return effectRank;
      if (a.rating !== b.rating) return b.rating - a.rating;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    })
    .slice(0, 5);
}

function spanText(endsAt: string, date: string, locale: string, untilLabel: string, nextDayLabel: string) {
  const time = formatTime(endsAt, locale);
  const phrase = locale === "si" ? `${time} ${untilLabel}` : `${untilLabel} ${time}`;
  return endsAt.startsWith(date) ? phrase : `${phrase} (${nextDayLabel})`;
}

export function DailyGuideClient() {
  const { dict, locale } = useLocale();
  const [request, setRequest] = useState<ScheduleRequest | null>(null);
  const [date, setDate] = useState<string>("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [data, setData] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedDefaults, setUsedDefaults] = useState(false);
  const [knownNakshatraIndex, setKnownNakshatraIndex] = useState(1);
  const [knownPaksha, setKnownPaksha] = useState<PakshaId>("waxing");

  const run = useCallback(async (nextRequest: ScheduleRequest) => {
    if (nextRequest.method === "nakshatra_paksha") {
      setKnownNakshatraIndex(nextRequest.nakshatra_index);
      setKnownPaksha(nextRequest.paksha);
    }
    setRequest(nextRequest);
    setDate(nextRequest.target_date);
    setLocation(locationFromRequest(nextRequest));
    setLoading(true);
    setError(null);
    try {
      const [panchanga, scheduleResult] = await Promise.all([
        fetchPanchanga({
          date: nextRequest.target_date,
          location_name: nextRequest.location_name,
          latitude: nextRequest.latitude,
          longitude: nextRequest.longitude,
          iana_tz: nextRequest.iana_tz,
        }),
        fetchScheduleWithServerTime(nextRequest),
      ]);
      setData({
        panchanga,
        schedule: scheduleResult.data,
        serverTime: scheduleResult.serverTime,
        fetchedAtClientMs: Date.now(),
      });
    } catch (e) {
      setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
    } finally {
      setLoading(false);
    }
  }, [dict.ui.error]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initial = await resolveDefaultScheduleRequest();
      if (cancelled) return;
      setUsedDefaults(true);
      void run(initial);
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  const viewingToday = Boolean(location && date === todayFor(location).date);
  const currentPeriod = viewingToday ? data?.schedule.current_period ?? null : null;
  const windows = useMemo(() => (data ? bestWindows(data.schedule) : []), [data]);

  function changeDate(nextDate: string) {
    const loc = location ?? mostRecentLocation() ?? DEFAULT_LOCATION;
    const base = request ?? {
      method: "bird",
      bird: "peacock",
      target_date: nextDate,
      target_time: targetTimeFor(nextDate, loc),
      location_name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      iana_tz: loc.iana_tz,
    };
    setUsedDefaults(false);
    void run(withDateLocation(base, nextDate, loc));
  }

  function changeLocation(nextLocation: LocationValue) {
    const base = request ?? {
      method: "bird",
      bird: "peacock",
      target_date: todayFor(nextLocation).date,
      target_time: todayFor(nextLocation).time,
      location_name: nextLocation.name,
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude,
      iana_tz: nextLocation.iana_tz,
    };
    const nextDate = date || todayFor(nextLocation).date;
    setUsedDefaults(false);
    void run(withDateLocation(base, nextDate, nextLocation));
  }

  function changeBird(bird: BirdId) {
    const loc = location ?? DEFAULT_LOCATION;
    const nextDate = date || todayFor(loc).date;
    setUsedDefaults(false);
    void run({
      method: "bird",
      bird,
      target_date: nextDate,
      target_time: targetTimeFor(nextDate, loc),
      location_name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      iana_tz: loc.iana_tz,
    });
  }

  function useKnownNakshatra() {
    const loc = location ?? DEFAULT_LOCATION;
    const nextDate = date || todayFor(loc).date;
    setUsedDefaults(false);
    void run({
      method: "nakshatra_paksha",
      nakshatra_index: knownNakshatraIndex,
      paksha: knownPaksha,
      target_date: nextDate,
      target_time: targetTimeFor(nextDate, loc),
      location_name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      iana_tz: loc.iana_tz,
    });
  }

  function pickProfile(profile: SavedProfile) {
    const loc = location ?? DEFAULT_LOCATION;
    const nextDate = date || todayFor(loc).date;
    const next = requestFromProfile(profile, nextDate, loc);
    if (!next) return;
    setUsedDefaults(false);
    void run(next);
  }

  const activeBird =
    request?.method === "bird" ? request.bird : data?.schedule.birth_bird ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <SunIcon className="text-3xl text-accent" />
          {dict.dailyGuide.title}
        </h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">
          {dict.dailyGuide.description}
        </p>
      </header>

      <section
        data-testid="daily-guide-controls"
        className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {dict.dailyGuide.controlsTitle}
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <div className="flex flex-col gap-4">
            {date && <DateNav date={date} onChange={changeDate} />}
            <div>
              <p className="mb-2 text-sm opacity-70">{dict.ui.location}</p>
              <LocationPicker value={location} onChange={changeLocation} />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
            <SavedProfiles onPick={pickProfile} saveCandidate={null} />
            <div
              data-testid="daily-guide-known-nakshatra"
              className="flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase opacity-60">
                    {dict.dailyGuide.knownNakshatraTitle}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed opacity-70">
                    {dict.dailyGuide.knownNakshatraDescription}
                  </p>
                </div>
                <Link
                  href={`/${locale}/birth-nakshatra`}
                  className="shrink-0 rounded-full border border-black/10 px-3 py-1 text-xs font-semibold hover:border-accent hover:text-accent dark:border-white/20"
                >
                  {dict.dailyGuide.findNakshatra}
                </Link>
              </div>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <label className="min-w-0 text-sm">
                  <span className="mb-1 block text-xs uppercase opacity-60">{dict.ui.birthNakshatra}</span>
                  <select
                    value={knownNakshatraIndex}
                    onChange={(e) => setKnownNakshatraIndex(Number(e.target.value))}
                    className="w-full min-w-0 rounded-lg border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/20"
                  >
                    {NAKSHATRAS.map((n) => (
                      <option key={n.id} value={n.id}>
                        {nakshatraName(n.id, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 text-sm">
                  <span className="mb-1 block text-xs uppercase opacity-60">{dict.ui.paksha}</span>
                  <select
                    value={knownPaksha}
                    onChange={(e) => setKnownPaksha(e.target.value as PakshaId)}
                    className="w-full min-w-0 rounded-lg border border-black/10 bg-background px-3 py-2 text-sm dark:border-white/20"
                  >
                    {(["waxing", "waning"] as PakshaId[]).map((p) => (
                      <option key={p} value={p}>
                        {translateEnum(dict, "paksha", p)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={useKnownNakshatra}
                className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
              >
                {dict.dailyGuide.useKnownNakshatra}
              </button>
            </div>
            <p className="border-t border-black/10 pt-3 text-xs font-semibold uppercase opacity-60 dark:border-white/10">
              {dict.ui.birthBird}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {BIRDS.map((bird) => {
                const Icon = BIRD_ICONS[bird];
                const active = activeBird === bird;
                return (
                  <button
                    key={bird}
                    type="button"
                    onClick={() => changeBird(bird)}
                    className={`flex min-h-10 items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-sm leading-tight ${
                      active
                        ? "border-accent bg-accent/10 font-semibold text-accent"
                        : "border-black/10 opacity-80 hover:opacity-100 dark:border-white/20"
                    }`}
                  >
                    <Icon className="shrink-0 text-lg" />
                    <span>{translateEnum(dict, "birds", bird)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {usedDefaults && data && (
        <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs">
          {dict.dailyGuide.showingDefaults}
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
          {request && (
            <button
              type="button"
              onClick={() => run(request)}
              className="mt-2 rounded-lg border border-black/10 px-3 py-1.5 dark:border-white/20"
            >
              {dict.ui.retry}
            </button>
          )}
        </div>
      )}

      {loading && !data && (
        <div role="status" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">{dict.ui.loading}</span>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl border border-black/10 motion-safe:animate-pulse dark:border-white/10" />
          ))}
        </div>
      )}

      {data && (
        <div data-testid="daily-guide-result" className="flex flex-col gap-5">
          <section
            data-testid="daily-guide-summary"
            className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.03]"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm opacity-70">{formatDate(data.panchanga.date, locale)}</p>
                <h2 className="mt-1 text-xl font-semibold">
                  {sinhalaMonthName(dict, data.panchanga.sinhala_month.key)}
                  {locale === "en" && ` ${dict.panchanga.sinhalaMonth}`}
                </h2>
                <p className="mt-1 text-sm opacity-80">
                  {data.schedule.location.name} · {translateEnum(dict, "paksha", data.panchanga.paksha)} ·{" "}
                  {translateEnum(dict, "birds", data.schedule.birth_bird)}
                </p>
              </div>
              <div className="flex flex-col gap-2 text-sm md:items-end">
                {data.panchanga.is_poya_day && data.panchanga.poya ? (
                  <span
                    data-testid="daily-guide-poya-badge"
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 font-semibold"
                  >
                    <FullMoonIcon className="text-lg text-amber-600 dark:text-amber-400" />
                    {dict.panchanga.poyaTodayLabel} · {sinhalaMonthName(dict, data.panchanga.poya.month_key)}
                  </span>
                ) : (
                  <span className="rounded-full border border-black/10 px-3 py-1.5 opacity-75 dark:border-white/10">
                    {dict.dailyGuide.notPoya}
                  </span>
                )}
                <span data-testid="daily-guide-next-poya" className="text-xs opacity-70">
                  {dict.panchanga.nextPoyaLabel}:{" "}
                  {sinhalaMonthName(dict, data.panchanga.next_poya.month_key)}{" "}
                  {new Date(`${data.panchanga.next_poya.date}T12:00:00`).toLocaleDateString(
                    locale === "si" ? "si-LK" : "en-US",
                    { month: "long", day: "numeric" },
                  )}
                </span>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="flex flex-col gap-5">
              <section
                data-testid="daily-guide-current"
                className="rounded-xl border border-black/10 p-4 dark:border-white/10"
              >
                <h2 className="text-sm font-semibold uppercase text-accent">{dict.dailyGuide.currentTitle}</h2>
                {currentPeriod ? (
                  <PeriodLine period={currentPeriod} featured />
                ) : (
                  <p className="mt-2 text-sm opacity-70">{dict.dailyGuide.currentUnavailable}</p>
                )}
              </section>

              <section
                data-testid="daily-guide-good-windows"
                className="rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-4"
              >
                <h2 className="text-sm font-semibold uppercase">{dict.dailyGuide.goodWindowsTitle}</h2>
                {windows.length === 0 ? (
                  <p className="mt-2 text-sm opacity-70">{dict.ui.noWindowsLeft}</p>
                ) : (
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {windows.map((period) => (
                      <li key={period.id}>
                        <PeriodLine period={period} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section
                data-testid="daily-guide-panchanga"
                className="grid gap-3 sm:grid-cols-2"
              >
                <GuideCard title={dict.panchanga.tithi}>
                  {data.panchanga.tithi.map((t) => (
                    <p key={`${t.key}-${t.ends_at}`} className="text-sm">
                      <strong>{translateEnum(dict, "tithis", t.key)}</strong>{" "}
                      <span className="opacity-70">
                        {spanText(t.ends_at, data.panchanga.date, locale, dict.panchanga.until, dict.panchanga.nextDay)}
                      </span>
                    </p>
                  ))}
                </GuideCard>
                <GuideCard title={dict.panchanga.nakshatra}>
                  {data.panchanga.nakshatra.map((n) => (
                    <p key={`${n.key}-${n.ends_at}`} className="text-sm">
                      <strong>{nakshatraName(n.index, locale)} · {dict.panchanga.pada} {n.pada}</strong>{" "}
                      <span className="opacity-70">
                        {spanText(n.ends_at, data.panchanga.date, locale, dict.panchanga.until, dict.panchanga.nextDay)}
                      </span>
                    </p>
                  ))}
                </GuideCard>
                <GuideCard title={dict.panchanga.yoga}>
                  {data.panchanga.yoga.map((y) => (
                    <p key={`${y.key}-${y.ends_at}`} className="text-sm">
                      <strong>{translateEnum(dict, "yogas", y.key)}</strong>{" "}
                      <span className="opacity-70">
                        {spanText(y.ends_at, data.panchanga.date, locale, dict.panchanga.until, dict.panchanga.nextDay)}
                      </span>
                    </p>
                  ))}
                </GuideCard>
                <GuideCard title={dict.panchanga.karana}>
                  {data.panchanga.karana.map((k) => (
                    <p key={`${k.index_60}-${k.ends_at}`} className="text-sm">
                      <strong>{translateEnum(dict, "karanas", k.key)}</strong>{" "}
                      <span className="opacity-70">
                        {spanText(k.ends_at, data.panchanga.date, locale, dict.panchanga.until, dict.panchanga.nextDay)}
                      </span>
                    </p>
                  ))}
                </GuideCard>
              </section>
            </section>

            <aside className="flex flex-col gap-5">
              <PersonalStrengthCard request={request} schedule={data.schedule} targetDate={data.panchanga.date} />

              <section
                data-testid="daily-guide-avoid-times"
                className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4"
              >
                <h2 className="text-sm font-semibold uppercase">{dict.dailyGuide.avoidTitle}</h2>
                <div className="mt-3 flex flex-col gap-2">
                  {(
                    [
                      ["rahu", dict.panchanga.rahuKala],
                      ["yamaganda", dict.panchanga.yamaganda],
                      ["gulika", dict.panchanga.gulika],
                    ] as const
                  ).map(([key, label]) => (
                    <TimeRow
                      key={key}
                      label={label}
                      value={`${formatTime(data.panchanga.kalams[key].starts_at, locale)}-${formatTime(
                        data.panchanga.kalams[key].ends_at,
                        locale,
                      )}`}
                    />
                  ))}
                </div>
                <p className="mt-3 text-xs opacity-70">{dict.panchanga.kalamsNote}</p>
              </section>

              <section
                data-testid="daily-guide-sun-moon"
                className="rounded-xl border border-black/10 p-4 dark:border-white/10"
              >
                <h2 className="text-sm font-semibold uppercase text-accent">{dict.panchanga.sunMoonTitle}</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <TimeRow label={dict.ui.sunrise} value={formatTime(data.panchanga.sunrise, locale)} />
                  <TimeRow label={dict.ui.sunset} value={formatTime(data.panchanga.sunset, locale)} />
                  <TimeRow
                    label={dict.panchanga.moonrise}
                    value={data.panchanga.moonrise ? formatTime(data.panchanga.moonrise, locale) : dict.panchanga.notVisible}
                  />
                  <TimeRow
                    label={dict.panchanga.moonset}
                    value={data.panchanga.moonset ? formatTime(data.panchanga.moonset, locale) : dict.panchanga.notVisible}
                  />
                </div>
              </section>

              <p className="rounded-xl border border-black/10 p-4 text-xs leading-relaxed opacity-70 dark:border-white/10">
                {dict.guidance.disclaimer}
              </p>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonalStrengthCard({
  request,
  schedule,
  targetDate,
}: {
  request: ScheduleRequest | null;
  schedule: ScheduleResponse;
  targetDate: string;
}) {
  const { dict, locale } = useLocale();
  const taraBala = schedule.tara_bala;
  const chandrashtama = schedule.chandrashtama;
  const hasFullBirthRequest = request?.method === "birth_datetime";

  return (
    <section
      data-testid="daily-guide-personal-strength"
      className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.03]"
    >
      <h2 className="text-sm font-semibold uppercase text-accent">
        {dict.dailyGuide.personalStrengthTitle}
      </h2>
      <p className="mt-1 text-xs leading-relaxed opacity-70">
        {dict.dailyGuide.personalStrengthDescription}
      </p>
      <dl className="mt-3 grid gap-3 text-sm">
        <StrengthFact
          label={dict.ui.dishaShool}
          value={translateEnum(dict, "directions", schedule.disha_shool)}
          testId="daily-guide-disha-shool"
        />
        {taraBala ? (
          <StrengthFact
            label={dict.ui.taraBala}
            value={`${translateEnum(dict, "taraCategories", taraBala.key)} — ${translateEnum(dict, "effects", taraBala.effect)}`}
            color={EFFECT_COLORS[taraBala.effect]}
            testId="daily-guide-tara-bala"
          />
        ) : (
          <StrengthFact
            label={dict.ui.taraBala}
            value={dict.dailyGuide.taraBalaPrompt}
            testId="daily-guide-tara-bala"
          />
        )}
        {chandrashtama ? (
          <StrengthFact
            label={dict.ui.chandrashtama}
            value={spanText(
              chandrashtama.ends_at,
              targetDate,
              locale,
              dict.ui.chandrashtamaUntil,
              dict.panchanga.nextDay,
            )}
            color={EFFECT_COLORS.bad}
            testId="daily-guide-chandrashtama"
          />
        ) : (
          <StrengthFact
            label={dict.ui.chandrashtama}
            value={
              hasFullBirthRequest
                ? dict.dailyGuide.chandrashtamaClear
                : dict.dailyGuide.chandrashtamaNeedsBirth
            }
            testId="daily-guide-chandrashtama"
          />
        )}
      </dl>
    </section>
  );
}

function PeriodLine({ period, featured = false }: { period: SubPeriod; featured?: boolean }) {
  const { dict, locale } = useLocale();
  const BirdIcon = BIRD_ICONS[period.sub_bird];
  const ActivityIcon = ACTIVITY_ICONS[period.sub_activity];
  return (
    <div
      className={`rounded-lg border border-black/10 bg-background p-3 dark:border-white/10 ${
        featured ? "mt-3" : ""
      }`}
      style={{ borderLeftWidth: 4, borderLeftColor: ACTIVITY_COLORS[period.sub_activity] }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular-nums">
          {formatTime(period.starts_at, locale)}-{formatTime(period.ends_at, locale)}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <BirdIcon className="text-lg" />
          <ActivityIcon className="text-lg" style={{ color: ACTIVITY_COLORS[period.sub_activity] }} />
        </span>
      </div>
      <p className="mt-1 text-sm">
        {translateEnum(dict, "birds", period.sub_bird)} ·{" "}
        {translateEnum(dict, "activities", period.sub_activity)} ·{" "}
        {translateEnum(dict, "effects", period.effect)}
      </p>
      <p className="mt-1 text-xs leading-relaxed opacity-70">
        {activityGuidance(dict, period.sub_activity)}
      </p>
    </div>
  );
}

function StrengthFact({
  label,
  value,
  color,
  testId,
}: {
  label: string;
  value: string;
  color?: string;
  testId?: string;
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

function GuideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
      <h2 className="text-xs font-semibold uppercase opacity-60">{title}</h2>
      <div className="mt-2 flex flex-col gap-1">{children}</div>
    </div>
  );
}

function TimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase opacity-60">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

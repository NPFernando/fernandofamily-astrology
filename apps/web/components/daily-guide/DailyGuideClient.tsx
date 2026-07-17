"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { getDictionary, NAKSHATRAS, nakshatraName, translateEnum } from "@/lib/i18n";
import {
  ApiError,
  fetchMuhurta,
  fetchPanchanga,
  fetchScheduleWithServerTime,
  type BirdId,
  type DailyPanchanga,
  type EffectId,
  type MuhurtaGrade,
  type MuhurtaWindow,
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
import {
  listProfiles,
  mergeLocalToServerOnce,
  type SavedProfile,
} from "@/lib/profiles";
import { useSessionProbe } from "@/lib/use-session-probe";
import { BIRD_ICONS } from "@/components/icons/birds";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { ACTIVITY_COLORS } from "@/components/pancha-pakshi/activityColors";
import { SunIcon } from "@/components/icons/sun";
import { FullMoonIcon } from "@/components/icons/moon";
import { activityGuidance } from "@/lib/pancha-guidance";
import { SkyTodayPanel } from "@/components/panchanga/SkyTodayPanel";
import { DailyTimingTimeline } from "@/components/panchanga/DailyTimingTimeline";
import { PoyaDetailCard } from "@/components/panchanga/PoyaDetailCard";
import { EFFECT_COLORS } from "@fernandofamily/design-system";

const BIRDS: BirdId[] = ["vulture", "owl", "crow", "cock", "peacock"];
const FAMILY_BOARD_LIMIT = 8;
const FAMILY_WEEK_DAYS = 7;
const FAMILY_WEEK_PROFILE_LIMIT = 4;
const FAMILY_WEEK_MIN_SHARED_SECONDS = 900;
const EFFECT_RANK: Record<EffectId, number> = {
  very_good: 0,
  good: 1,
  average: 2,
  bad: 3,
  very_bad: 4,
};
const MUHURTA_GRADE_RANK: Record<MuhurtaGrade, number> = { excellent: 0, good: 1, usable: 2 };

type GuideData = {
  panchanga: DailyPanchanga;
  schedule: ScheduleResponse;
  serverTime: Date | null;
  fetchedAtClientMs: number;
  referenceAt: string;
};

type FamilyBoardRow = {
  profile: SavedProfile;
  request: ScheduleRequest;
  schedule: ScheduleResponse | null;
  failed: boolean;
};

type FamilyWeekProfileResult = {
  profile: SavedProfile;
  windows: MuhurtaWindow[];
  failed: boolean;
};

type SharedFamilyWindow = {
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  grade: MuhurtaGrade;
  average_score: number;
  windows: MuhurtaWindow[];
};

type IndividualFamilyWindow = {
  profile: SavedProfile;
  window: MuhurtaWindow;
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

function validDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
      moon_rashi_index: request.moon_rashi_index ?? null,
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
      moon_rashi_index: profile.moon_rashi_index ?? null,
    };
  }
  return null;
}

function muhurtaRequestFromProfile(profile: SavedProfile, date: string, location: LocationValue) {
  const base = {
    from_date: date,
    days: FAMILY_WEEK_DAYS,
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
    purpose: "general" as const,
    min_effect: "good" as const,
    min_duration_seconds: FAMILY_WEEK_MIN_SHARED_SECONDS,
  };
  if (profile.bird) return { ...base, method: "bird" as const, bird: profile.bird };
  if (profile.nakshatra_index && profile.paksha) {
    return {
      ...base,
      method: "nakshatra_paksha" as const,
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

function bestMuhurtaWindow(windows: MuhurtaWindow[]): MuhurtaWindow | null {
  return [...windows].sort((a, b) => {
    const grade = MUHURTA_GRADE_RANK[a.grade] - MUHURTA_GRADE_RANK[b.grade];
    if (grade !== 0) return grade;
    if (a.score !== b.score) return b.score - a.score;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  })[0] ?? null;
}

function overlapWindow(aStart: string, aEnd: string, bStart: string, bEnd: string): { starts_at: string; ends_at: string } | null {
  const startMs = Math.max(new Date(aStart).getTime(), new Date(bStart).getTime());
  const endMs = Math.min(new Date(aEnd).getTime(), new Date(bEnd).getTime());
  if (endMs - startMs < FAMILY_WEEK_MIN_SHARED_SECONDS * 1000) return null;
  return {
    starts_at: new Date(aStart).getTime() >= new Date(bStart).getTime() ? aStart : bStart,
    ends_at: new Date(aEnd).getTime() <= new Date(bEnd).getTime() ? aEnd : bEnd,
  };
}

function sharedWindowsForDay(results: FamilyWeekProfileResult[], date: string): SharedFamilyWindow[] {
  const usable = results
    .filter((result) => !result.failed)
    .map((result) => ({
      profile: result.profile,
      windows: result.windows.filter((window) => window.effective_date === date),
    }))
    .filter((result) => result.windows.length > 0);
  if (usable.length === 0 || usable.length !== results.length) return [];

  let candidates = usable[0].windows.map((window) => ({
    starts_at: window.starts_at,
    ends_at: window.ends_at,
    windows: [window],
  }));

  for (const result of usable.slice(1)) {
    const next = [];
    for (const candidate of candidates) {
      for (const window of result.windows) {
        const overlap = overlapWindow(candidate.starts_at, candidate.ends_at, window.starts_at, window.ends_at);
        if (overlap) next.push({ ...overlap, windows: [...candidate.windows, window] });
      }
    }
    candidates = next;
    if (candidates.length === 0) return [];
  }

  return candidates
    .map((candidate) => {
      const grade = candidate.windows.reduce<MuhurtaGrade>(
        (worst, window) =>
          MUHURTA_GRADE_RANK[window.grade] > MUHURTA_GRADE_RANK[worst] ? window.grade : worst,
        "excellent",
      );
      return {
        ...candidate,
        duration_seconds: Math.round((new Date(candidate.ends_at).getTime() - new Date(candidate.starts_at).getTime()) / 1000),
        grade,
        average_score: candidate.windows.reduce((sum, window) => sum + window.score, 0) / candidate.windows.length,
      };
    })
    .sort((a, b) => {
      const grade = MUHURTA_GRADE_RANK[a.grade] - MUHURTA_GRADE_RANK[b.grade];
      if (grade !== 0) return grade;
      if (a.average_score !== b.average_score) return b.average_score - a.average_score;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
}

function individualWindowsForDay(results: FamilyWeekProfileResult[], date: string): IndividualFamilyWindow[] {
  return results
    .filter((result) => !result.failed)
    .flatMap((result) => {
      const best = bestMuhurtaWindow(result.windows.filter((window) => window.effective_date === date));
      return best ? [{ profile: result.profile, window: best }] : [];
    })
    .sort((a, b) => {
      const grade = MUHURTA_GRADE_RANK[a.window.grade] - MUHURTA_GRADE_RANK[b.window.grade];
      if (grade !== 0) return grade;
      if (a.window.score !== b.window.score) return b.window.score - a.window.score;
      return new Date(a.window.starts_at).getTime() - new Date(b.window.starts_at).getTime();
    });
}

function spanText(endsAt: string, date: string, locale: string, untilLabel: string, nextDayLabel: string) {
  const time = formatTime(endsAt, locale);
  const phrase = locale === "si" ? `${time} ${untilLabel}` : `${untilLabel} ${time}`;
  return endsAt.startsWith(date) ? phrase : `${phrase} (${nextDayLabel})`;
}

function offsetSuffix(iso: string): string {
  return iso.endsWith("Z") ? "Z" : iso.slice(-6);
}

function requestReferenceIso(request: ScheduleRequest, panchanga: DailyPanchanga): string {
  return `${request.target_date}T${request.target_time}${offsetSuffix(panchanga.sunrise)}`;
}

export function DailyGuideClient() {
  const { dict, locale } = useLocale();
  const searchParams = useSearchParams();
  const requestedDate = validDateParam(searchParams.get("date"));
  const [request, setRequest] = useState<ScheduleRequest | null>(null);
  const [date, setDate] = useState<string>("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [data, setData] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedDefaults, setUsedDefaults] = useState(false);
  const [knownNakshatraIndex, setKnownNakshatraIndex] = useState(1);
  const [knownPaksha, setKnownPaksha] = useState<PakshaId>("waxing");
  const [activeView, setActiveView] = useState<"today" | "week">("today");

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
        referenceAt: requestReferenceIso(nextRequest, panchanga),
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
      const initialLocation = locationFromRequest(initial);
      const next = requestedDate ? withDateLocation(initial, requestedDate, initialLocation) : initial;
      setUsedDefaults(!requestedDate);
      void run(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedDate, run]);

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
      moon_rashi_index: null,
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

  function useWeekDate(nextDate: string) {
    setActiveView("today");
    changeDate(nextDate);
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

      <div
        className="flex w-fit rounded-lg border border-black/10 bg-white/30 p-1 text-sm dark:border-white/10 dark:bg-white/[.03]"
        data-testid="daily-guide-view-tabs"
      >
        {(["today", "week"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className={`rounded-md px-3 py-1.5 font-semibold transition ${
              activeView === view ? "bg-accent text-white" : "hover:bg-black/5 dark:hover:bg-white/10"
            }`}
          >
            {view === "today" ? dict.dailyGuide.viewToday : dict.dailyGuide.viewWeek}
          </button>
        ))}
      </div>

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
            <div
              data-testid="daily-guide-known-nakshatra"
              className="flex flex-col gap-3"
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

      {data && activeView === "week" && location && date && (
        <FamilyWeekPlanner startDate={date} location={location} onUseDate={useWeekDate} />
      )}

      {data && activeView === "today" && (
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
              </div>
            </div>
          </section>

          <PoyaDetailCard
            locale={locale}
            dict={dict}
            date={data.panchanga.is_poya_day ? data.panchanga.date : data.panchanga.next_poya.date}
            titleMonthKey={
              data.panchanga.is_poya_day && data.panchanga.poya
                ? data.panchanga.poya.month_key
                : data.panchanga.next_poya.month_key
            }
            isPoyaDay={data.panchanga.is_poya_day}
            todayLabel={dict.panchanga.poyaTodayLabel}
            upcomingLabel={dict.dailyGuide.nextPoyaDetailTitle}
            moonrise={data.panchanga.is_poya_day ? data.panchanga.moonrise : undefined}
            moonset={data.panchanga.is_poya_day ? data.panchanga.moonset : undefined}
            tithi={data.panchanga.is_poya_day ? data.panchanga.tithi : undefined}
            href={`/${locale}/moon-calendar?date=${
              data.panchanga.is_poya_day ? data.panchanga.date : data.panchanga.next_poya.date
            }`}
            actionLabel={dict.dailyGuide.openMoonCalendar}
            testId="daily-guide-poya-detail"
          />

          <DailyTimingTimeline
            panchanga={data.panchanga}
            schedule={data.schedule}
            referenceAt={data.referenceAt}
            testId="daily-guide-timing-timeline"
          />

          {location && (
            <FamilyDayBoard
              date={date || data.panchanga.date}
              location={location}
              onPickProfile={pickProfile}
            />
          )}

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

              <SkyTodayPanel panchanga={data.panchanga} compact testId="daily-guide-sky-today" />

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

function FamilyWeekPlanner({
  startDate,
  location,
  onUseDate,
}: {
  startDate: string;
  location: LocationValue;
  onUseDate: (date: string) => void;
}) {
  const { dict, locale } = useLocale();
  const probe = useSessionProbe();
  const signedIn = Boolean(probe.user?.email);
  const dates = useMemo(() => Array.from({ length: FAMILY_WEEK_DAYS }, (_, i) => addDays(startDate, i)), [startDate]);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [panchangas, setPanchangas] = useState<Record<string, DailyPanchanga>>({});
  const [profileResults, setProfileResults] = useState<FamilyWeekProfileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!probe.loaded) return;
    let cancelled = false;
    (async () => {
      try {
        if (signedIn) await mergeLocalToServerOnce();
        const complete = (await listProfiles(signedIn)).filter((profile) => muhurtaRequestFromProfile(profile, startDate, location));
        if (cancelled) return;
        setProfiles(complete);
        setSelectedIds(complete.slice(0, FAMILY_WEEK_PROFILE_LIMIT).map((profile) => profile.id));
      } finally {
        if (!cancelled) setProfilesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location, probe.loaded, signedIn, startDate]);

  const selectedProfiles = useMemo(
    () => profiles.filter((profile) => selectedIds.includes(profile.id)).slice(0, FAMILY_WEEK_PROFILE_LIMIT),
    [profiles, selectedIds],
  );

  useEffect(() => {
    if (!profilesLoaded) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const panchangaSettled = await Promise.allSettled(
          dates.map((date) =>
            fetchPanchanga({
              date,
              location_name: location.name,
              latitude: location.latitude,
              longitude: location.longitude,
              iana_tz: location.iana_tz,
            }),
          ),
        );
        if (cancelled) return;
        const nextPanchangas: Record<string, DailyPanchanga> = {};
        panchangaSettled.forEach((result, index) => {
          if (result.status === "fulfilled") nextPanchangas[dates[index]] = result.value;
        });
        setPanchangas(nextPanchangas);

        const requests = selectedProfiles.flatMap((profile) => {
          const request = muhurtaRequestFromProfile(profile, startDate, location);
          return request ? [{ profile, request }] : [];
        });
        const settled = await Promise.allSettled(requests.map(({ request }) => fetchMuhurta(request)));
        if (cancelled) return;
        setProfileResults(
          requests.map(({ profile }, index) => {
            const result = settled[index];
            return {
              profile,
              windows: result.status === "fulfilled" ? result.value.windows : [],
              failed: result.status === "rejected",
            };
          }),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dates, dict.ui.error, location, profilesLoaded, selectedProfiles, startDate]);

  function toggleProfile(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= FAMILY_WEEK_PROFILE_LIMIT) return current;
      return [...current, id];
    });
  }

  return (
    <section
      data-testid="daily-guide-family-week-planner"
      className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.03]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase text-accent">{dict.dailyGuide.familyWeekTitle}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed opacity-70">{dict.dailyGuide.familyWeekDescription}</p>
          <p className="mt-2 text-xs opacity-70">
            {formatDate(startDate, locale)} - {formatDate(dates[dates.length - 1], locale)}
          </p>
        </div>
        <p className="rounded-full border border-black/10 px-3 py-1.5 text-xs opacity-75 dark:border-white/10">
          {dict.dailyGuide.familyWeekSelected.replace("{count}", String(selectedProfiles.length))}
        </p>
      </div>

      {!profilesLoaded ? (
        <p role="status" className="mt-4 text-sm opacity-70">{dict.dailyGuide.familyBoardLoading}</p>
      ) : profiles.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-black/20 p-4 text-sm dark:border-white/20">
          <p className="font-semibold">{dict.dailyGuide.familyWeekEmptyTitle}</p>
          <p className="mt-1 opacity-70">{dict.dailyGuide.familyWeekEmptyBody}</p>
          <Link
            href={`/${locale}/birth-nakshatra`}
            className="mt-3 inline-flex rounded-lg border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10"
          >
            {dict.dailyGuide.familyBoardCreateProfile}
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" data-testid="daily-guide-family-week-profiles">
            {profiles.map((profile) => {
              const selected = selectedIds.includes(profile.id);
              const disabled = !selected && selectedIds.length >= FAMILY_WEEK_PROFILE_LIMIT;
              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleProfile(profile.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    selected
                      ? "border-accent bg-accent/10 font-semibold text-accent"
                      : "border-black/10 opacity-80 hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"
                  }`}
                >
                  {profile.label}
                </button>
              );
            })}
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
              {error}
            </div>
          ) : null}

          {loading && Object.keys(panchangas).length === 0 ? (
            <div role="status" className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
              <span className="sr-only">{dict.ui.loading}</span>
              {dates.map((day) => (
                <div key={day} className="h-36 rounded-lg border border-black/10 motion-safe:animate-pulse dark:border-white/10" />
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {dates.map((day) => (
              <FamilyWeekDayCard
                key={day}
                date={day}
                panchanga={panchangas[day] ?? null}
                results={profileResults}
                loading={loading}
                onUseDate={() => onUseDate(day)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function FamilyWeekDayCard({
  date,
  panchanga,
  results,
  loading,
  onUseDate,
}: {
  date: string;
  panchanga: DailyPanchanga | null;
  results: FamilyWeekProfileResult[];
  loading: boolean;
  onUseDate: () => void;
}) {
  const { dict, locale } = useLocale();
  const shared = sharedWindowsForDay(results, date)[0] ?? null;
  const individual = individualWindowsForDay(results, date).slice(0, 2);

  return (
    <article
      data-testid="daily-guide-family-week-day"
      className="flex min-w-0 flex-col rounded-lg border border-black/10 bg-background p-3 text-sm dark:border-white/10"
    >
      <div>
        <p className="text-xs font-semibold uppercase opacity-60">
          {new Date(`${date}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", { weekday: "short" })}
        </p>
        <h3 className="mt-1 font-semibold">{formatDate(date, locale)}</h3>
        {panchanga ? (
          <p className="mt-1 text-xs opacity-70">{sinhalaMonthName(dict, panchanga.sinhala_month.key)}</p>
        ) : null}
      </div>

      {panchanga?.is_poya_day && panchanga.poya ? (
        <span
          data-testid="daily-guide-family-week-poya"
          className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-xs font-semibold"
        >
          <FullMoonIcon className="text-base text-amber-600 dark:text-amber-400" />
          {sinhalaMonthName(dict, panchanga.poya.month_key)}
        </span>
      ) : null}

      {panchanga ? (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
          <p className="font-semibold">{dict.dailyGuide.avoidTitle}</p>
          <p className="mt-1 tabular-nums">
            {formatTime(panchanga.kalams.rahu.starts_at, locale)}-{formatTime(panchanga.kalams.rahu.ends_at, locale)}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-1 flex-col gap-2">
        {shared ? (
          <div
            data-testid="daily-guide-family-week-shared-window"
            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs"
          >
            <p className="font-semibold">{dict.dailyGuide.familyWeekSharedWindow}</p>
            <p className="mt-1 tabular-nums">
              {formatTime(shared.starts_at, locale)}-{formatTime(shared.ends_at, locale)}
            </p>
            <p className="mt-0.5 opacity-75">
              {dict.muhurta.grades[shared.grade]} · {Math.round(shared.average_score)}
            </p>
          </div>
        ) : individual.length > 0 ? (
          <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-2 text-xs">
            <p className="font-semibold">{dict.dailyGuide.familyWeekIndividualFallback}</p>
            <div className="mt-1 grid gap-1">
              {individual.map(({ profile, window }) => (
                <p key={`${profile.id}-${window.starts_at}`} data-testid="daily-guide-family-week-individual-window">
                  <span className="font-medium">{profile.label}</span>{" "}
                  <span className="tabular-nums">
                    {formatTime(window.starts_at, locale)}-{formatTime(window.ends_at, locale)}
                  </span>
                </p>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-black/10 p-2 text-xs opacity-70 dark:border-white/10">
            {loading ? dict.dailyGuide.familyBoardLoading : dict.dailyGuide.familyWeekNoWindows}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onUseDate}
        data-testid="daily-guide-family-week-use-date"
        className="mt-3 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
      >
        {dict.dailyGuide.familyWeekUseDate}
      </button>
    </article>
  );
}

function FamilyDayBoard({
  date,
  location,
  onPickProfile,
}: {
  date: string;
  location: LocationValue;
  onPickProfile: (profile: SavedProfile) => void;
}) {
  const { dict, locale } = useLocale();
  const probe = useSessionProbe();
  const signedIn = Boolean(probe.user?.email);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [profileCount, setProfileCount] = useState(0);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [rows, setRows] = useState<FamilyBoardRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!probe.loaded) return;
    let cancelled = false;
    (async () => {
      try {
        if (signedIn) await mergeLocalToServerOnce();
        const next = await listProfiles(signedIn);
        if (cancelled) return;
        setProfileCount(next.length);
        setProfiles(next.slice(0, FAMILY_BOARD_LIMIT));
      } finally {
        if (!cancelled) setProfilesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [probe.loaded, signedIn]);

  useEffect(() => {
    if (!profilesLoaded || profiles.length === 0) {
      return;
    }
    const requests = profiles.flatMap((profile) => {
      const request = requestFromProfile(profile, date, location);
      return request ? [{ profile, request }] : [];
    });
    if (requests.length === 0) {
      return;
    }

    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setRows(requests.map(({ profile, request }) => ({ profile, request, schedule: null, failed: false })));
      const settled = await Promise.allSettled(
        requests.map(({ request }) => fetchScheduleWithServerTime(request).then((result) => result.data)),
      );
      if (cancelled) return;
      setRows(
        requests.map(({ profile, request }, index) => {
          const result = settled[index];
          return {
            profile,
            request,
            schedule: result.status === "fulfilled" ? result.value : null,
            failed: result.status === "rejected",
          };
        }),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [date, location, profiles, profilesLoaded]);

  const limited = profileCount > profiles.length;

  return (
    <section
      data-testid="daily-guide-family-board"
      className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.03]"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase text-accent">{dict.dailyGuide.familyBoardTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed opacity-70">{dict.dailyGuide.familyBoardDescription}</p>
        </div>
        {limited && (
          <p className="text-xs opacity-70">
            {dict.dailyGuide.familyBoardLimited.replace("{count}", String(FAMILY_BOARD_LIMIT))}
          </p>
        )}
      </div>

      {!profilesLoaded ? (
        <p role="status" className="mt-4 text-sm opacity-70">{dict.dailyGuide.familyBoardLoading}</p>
      ) : profiles.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-black/20 p-4 text-sm dark:border-white/20">
          <p className="font-semibold">{dict.dailyGuide.familyBoardEmptyTitle}</p>
          <p className="mt-1 opacity-70">{dict.dailyGuide.familyBoardEmptyBody}</p>
          <Link
            href={`/${locale}/birth-nakshatra`}
            className="mt-3 inline-flex rounded-lg border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10"
          >
            {dict.dailyGuide.familyBoardCreateProfile}
          </Link>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rows.map((row) => (
            <FamilyProfileCard
              key={row.profile.id}
              row={row}
              loading={loading && row.schedule === null && !row.failed}
              onPick={() => onPickProfile(row.profile)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FamilyProfileCard({
  row,
  loading,
  onPick,
}: {
  row: FamilyBoardRow;
  loading: boolean;
  onPick: () => void;
}) {
  const { dict, locale } = useLocale();
  const { profile, schedule, failed } = row;
  const best = schedule ? bestWindows(schedule)[0] ?? null : null;
  const BirdIcon = BIRD_ICONS[schedule?.birth_bird ?? profile.bird ?? "peacock"];

  return (
    <article
      data-testid="daily-guide-family-profile"
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-black/10 bg-background p-3 text-sm dark:border-white/10"
    >
      <div className="flex min-w-0 items-start gap-2">
        <BirdIcon className="mt-0.5 shrink-0 text-xl text-accent" />
        <div className="min-w-0">
          <h3 className="break-words font-semibold">{profile.label}</h3>
          <p className="text-xs opacity-70">
            {schedule
              ? translateEnum(dict, "birds", schedule.birth_bird)
              : profile.bird
                ? translateEnum(dict, "birds", profile.bird)
                : profile.nakshatra_index
                  ? nakshatraName(profile.nakshatra_index, locale)
                  : dict.dailyGuide.familyBoardLoading}
          </p>
        </div>
      </div>

      {failed ? (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs">
          {dict.dailyGuide.familyBoardLoadFailed}
        </p>
      ) : (
        <dl className="grid gap-2">
          <FamilyFact
            label={dict.ui.taraBala}
            value={
              loading
                ? dict.dailyGuide.familyBoardLoading
                : schedule?.tara_bala
                  ? `${translateEnum(dict, "taraCategories", schedule.tara_bala.key)} · ${translateEnum(dict, "effects", schedule.tara_bala.effect)}`
                  : dict.dailyGuide.familyBoardNeedsNakshatra
            }
            color={schedule?.tara_bala ? EFFECT_COLORS[schedule.tara_bala.effect] : undefined}
          />
          <FamilyFact
            label={dict.ui.chandrashtama}
            value={
              loading
                ? dict.dailyGuide.familyBoardLoading
                : schedule?.chandrashtama
                  ? spanText(
                      schedule.chandrashtama.ends_at,
                      row.request.target_date,
                      locale,
                      dict.ui.chandrashtamaUntil,
                      dict.panchanga.nextDay,
                    )
                  : profile.moon_rashi_index != null
                    ? dict.dailyGuide.chandrashtamaClear
                    : dict.dailyGuide.familyBoardNeedsMoonRashi
            }
            color={schedule?.chandrashtama ? EFFECT_COLORS.bad : undefined}
          />
          <FamilyFact
            label={dict.dailyGuide.familyBoardBestWindow}
            value={
              loading
                ? dict.dailyGuide.familyBoardLoading
                : best
                  ? `${formatTime(best.starts_at, locale)}-${formatTime(best.ends_at, locale)} · ${translateEnum(dict, "effects", best.effect)}`
                  : dict.ui.noWindowsLeft
            }
            color={best ? EFFECT_COLORS[best.effect] : undefined}
          />
        </dl>
      )}

      <button
        type="button"
        onClick={onPick}
        className="mt-auto rounded-lg border border-accent/40 px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/10"
      >
        {dict.dailyGuide.familyBoardUseProfile}
      </button>
    </article>
  );
}

function FamilyFact({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase opacity-60">{label}</dt>
      <dd className="mt-0.5 break-words font-medium" style={color ? { color } : undefined}>
        {value}
      </dd>
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
  const hasMoonRashi =
    request?.method === "birth_datetime" ||
    (request?.method === "nakshatra_paksha" && request.moon_rashi_index != null);

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
              hasMoonRashi
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

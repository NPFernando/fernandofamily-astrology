"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { getDictionary, resolveKey, translateEnum } from "@/lib/i18n";
import {
  ApiError,
  fetchMuhurta,
  fetchMuhurtaMonth,
  type BirdId,
  type MuhurtaGrade,
  type MuhurtaMonthDay,
  type MuhurtaMonthRequest,
  type MuhurtaMonthResponse,
  type MuhurtaPurpose,
  type MuhurtaSearchRequest,
  type MuhurtaSearchResponse,
  type MuhurtaSource,
  type MuhurtaCautionInfo,
  type MuhurtaWindow,
  type ScheduleRequest,
} from "@/lib/api-client";
import { features } from "@/lib/feature-registry";
import { listProfiles, mergeLocalToServerOnce, type SavedProfile } from "@/lib/profiles";
import { useSessionProbe } from "@/lib/use-session-probe";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { DateNav } from "@/components/pancha-pakshi/DateNav";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { resolveDefaultScheduleRequest } from "@/lib/pancha-schedule-state";
import { BIRD_ICONS } from "@/components/icons/birds";

const feature = features.find((f) => f.id === "muhurta")!;
const BIRDS: BirdId[] = ["vulture", "owl", "crow", "cock", "peacock"];
const PURPOSES: MuhurtaPurpose[] = [
  "general",
  "travel",
  "study_work",
  "purchase",
  "home_ritual",
  "business_opening",
  "vehicle_purchase",
  "wedding_engagement",
];
const FAMILY_PROFILE_LIMIT = 4;
const FAMILY_DAY_LIMIT = 7;
const FAMILY_RESULT_LIMIT = 6;
const MIN_SHARED_SECONDS = 900;
const GRADE_RANK: Record<MuhurtaGrade, number> = { excellent: 0, good: 1, usable: 2 };
const GRADE_STYLE: Record<MuhurtaGrade, string> = {
  excellent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  good: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  usable: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

type Dictionary = ReturnType<typeof getDictionary>;

type FamilyProfileResult = {
  profile: SavedProfile;
  response: MuhurtaSearchResponse | null;
  failed: boolean;
};

type FamilySharedWindow = {
  effective_date: string;
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  grade: MuhurtaGrade;
  score: number;
  profiles: SavedProfile[];
  windows: MuhurtaWindow[];
};

function todayFor(location: LocationValue): string {
  return nowAsTargetDateTime(location.iana_tz).date;
}

function monthFromDate(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) };
}

function monthInputValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1, 12);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function locationFromRequest(request: ScheduleRequest): LocationValue {
  return {
    name: request.location_name,
    latitude: request.latitude,
    longitude: request.longitude,
    iana_tz: request.iana_tz,
  };
}

function toMuhurtaRequest(
  request: ScheduleRequest,
  date: string,
  location: LocationValue,
  purpose: MuhurtaPurpose,
  days: number,
  minEffect: "good" | "very_good",
): MuhurtaSearchRequest {
  const base = {
    from_date: date,
    days,
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
    purpose,
    min_effect: minEffect,
    min_duration_seconds: 900,
  };
  if (request.method === "birth_datetime") {
    return {
      ...base,
      method: "birth_datetime",
      birth_date: request.birth_date,
      birth_time: request.birth_time,
    };
  }
  if (request.method === "nakshatra_paksha") {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: request.nakshatra_index,
      paksha: request.paksha,
    };
  }
  return { ...base, method: "bird", bird: request.bird };
}

function toMuhurtaMonthRequest(
  request: ScheduleRequest,
  year: number,
  month: number,
  location: LocationValue,
  purpose: MuhurtaPurpose,
  minEffect: "good" | "very_good",
): MuhurtaMonthRequest {
  const base = {
    year,
    month,
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
    purpose,
    min_effect: minEffect,
    min_duration_seconds: 900,
  };
  if (request.method === "birth_datetime") {
    return {
      ...base,
      method: "birth_datetime",
      birth_date: request.birth_date,
      birth_time: request.birth_time,
    };
  }
  if (request.method === "nakshatra_paksha") {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: request.nakshatra_index,
      paksha: request.paksha,
    };
  }
  return { ...base, method: "bird", bird: request.bird };
}

function withBird(request: ScheduleRequest | null, bird: BirdId, date: string, location: LocationValue): ScheduleRequest {
  return {
    method: "bird",
    bird,
    target_date: date,
    target_time: "12:00:00",
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
    ...(request?.method === "bird" ? {} : {}),
  };
}

function formatDate(date: string, locale: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(date: string, locale: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMonthName(year: number, month: number, locale: string) {
  return new Date(year, month - 1, 1).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationText(seconds: number, dict: ReturnType<typeof getDictionary>) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${dict.muhurta.minutes}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ${dict.muhurta.hours} ${rest} ${dict.muhurta.minutes}` : `${hours} ${dict.muhurta.hours}`;
}

function sourceLabel(source: MuhurtaSource, dict: ReturnType<typeof getDictionary>) {
  return dict.muhurta.sources[source];
}

function cautionValue(caution: MuhurtaCautionInfo, dict: ReturnType<typeof getDictionary>): string {
  return translateEnum(dict, "directions", caution.value);
}

function sinhalaMonthName(dict: Dictionary, key: string): string {
  const isAdhi = key.startsWith("adhi-");
  const baseKey = isAdhi ? key.slice(5) : key;
  const baseName = translateEnum(dict, "sinhalaMonths", baseKey);
  return isAdhi ? `${dict.panchanga.adhiPrefix} ${baseName}` : baseName;
}

function requestFromProfile(profile: SavedProfile, date: string, location: LocationValue): ScheduleRequest | null {
  const base = {
    target_date: date,
    target_time: "12:00:00",
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
  };
  if (profile.bird) return { ...base, method: "bird", bird: profile.bird };
  if (profile.nakshatra_index != null && profile.paksha) {
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

function familyGrade(windows: MuhurtaWindow[]): MuhurtaGrade {
  return windows.reduce<MuhurtaGrade>(
    (worst, window) => (GRADE_RANK[window.grade] > GRADE_RANK[worst] ? window.grade : worst),
    "excellent",
  );
}

function buildSharedWindows(results: FamilyProfileResult[]): FamilySharedWindow[] {
  const rows = results.filter(
    (row): row is FamilyProfileResult & { response: MuhurtaSearchResponse } => Boolean(row.response) && !row.failed,
  );
  if (rows.length !== results.length || rows.length < 2) return [];

  let candidates: FamilySharedWindow[] = rows[0].response.windows.map((window) => ({
    effective_date: window.effective_date,
    starts_at: window.starts_at,
    ends_at: window.ends_at,
    duration_seconds: window.duration_seconds,
    grade: window.grade,
    score: window.score,
    profiles: [rows[0].profile],
    windows: [window],
  }));

  for (const row of rows.slice(1)) {
    const nextCandidates: FamilySharedWindow[] = [];
    for (const candidate of candidates) {
      for (const window of row.response.windows) {
        if (window.effective_date !== candidate.effective_date) continue;
        const startMs = Math.max(new Date(candidate.starts_at).getTime(), new Date(window.starts_at).getTime());
        const endMs = Math.min(new Date(candidate.ends_at).getTime(), new Date(window.ends_at).getTime());
        const durationSeconds = Math.floor((endMs - startMs) / 1000);
        if (durationSeconds < MIN_SHARED_SECONDS) continue;
        const windows = [...candidate.windows, window];
        nextCandidates.push({
          effective_date: candidate.effective_date,
          starts_at: new Date(startMs).toISOString(),
          ends_at: new Date(endMs).toISOString(),
          duration_seconds: durationSeconds,
          grade: familyGrade(windows),
          score: Math.min(...windows.map((item) => item.score)),
          profiles: [...candidate.profiles, row.profile],
          windows,
        });
      }
    }
    candidates = nextCandidates;
    if (!candidates.length) break;
  }

  return candidates
    .sort((a, b) => {
      const grade = GRADE_RANK[a.grade] - GRADE_RANK[b.grade];
      if (grade !== 0) return grade;
      if (a.score !== b.score) return b.score - a.score;
      if (a.duration_seconds !== b.duration_seconds) return b.duration_seconds - a.duration_seconds;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    })
    .slice(0, FAMILY_RESULT_LIMIT);
}

function bestIndividualWindow(response: MuhurtaSearchResponse | null): MuhurtaWindow | null {
  if (!response?.windows.length) return null;
  return [...response.windows].sort((a, b) => {
    const grade = GRADE_RANK[a.grade] - GRADE_RANK[b.grade];
    if (grade !== 0) return grade;
    if (a.score !== b.score) return b.score - a.score;
    if (a.duration_seconds !== b.duration_seconds) return b.duration_seconds - a.duration_seconds;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  })[0];
}

function profileIdentityText(profile: SavedProfile, dict: Dictionary) {
  if (profile.bird) return translateEnum(dict, "birds", profile.bird);
  if (profile.nakshatra_index != null && profile.paksha) {
    return `Nakshatra ${profile.nakshatra_index} - ${profile.paksha}`;
  }
  return dict.muhurta.familyLoadFailed;
}

function FamilyMuhurtaPanel({
  date,
  location,
  purpose,
  days,
  minEffect,
  locale,
  dict,
}: {
  date: string;
  location: LocationValue;
  purpose: MuhurtaPurpose;
  days: number;
  minEffect: "good" | "very_good";
  locale: string;
  dict: Dictionary;
}) {
  const session = useSessionProbe();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [resultState, setResultState] = useState<{ key: string; rows: FamilyProfileResult[] } | null>(null);

  useEffect(() => {
    if (!session.loaded) return;
    let cancelled = false;
    (async () => {
      const signedIn = Boolean(session.user);
      if (signedIn) await mergeLocalToServerOnce();
      const nextProfiles = await listProfiles(signedIn);
      if (cancelled) return;
      setProfiles(nextProfiles);
      setSelectedIds((current) => {
        const validIds = nextProfiles
          .filter((profile) => profile.bird || (profile.nakshatra_index != null && profile.paksha))
          .map((profile) => profile.id);
        const kept = current.filter((id) => validIds.includes(id)).slice(0, FAMILY_PROFILE_LIMIT);
        return kept.length ? kept : validIds.slice(0, 2);
      });
      setLoadingProfiles(false);
    })().catch(() => {
      if (!cancelled) {
        setProfiles([]);
        setSelectedIds([]);
        setLoadingProfiles(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.loaded, session.user]);

  const validProfiles = profiles.filter((profile) => requestFromProfile(profile, date, location));
  const visibleProfiles = validProfiles.slice(0, FAMILY_PROFILE_LIMIT);
  const selectedProfiles = validProfiles.filter((profile) => selectedIds.includes(profile.id));
  const familyDays = Math.min(days, FAMILY_DAY_LIMIT);
  const comparisonKey = [
    date,
    location.name,
    location.latitude,
    location.longitude,
    location.iana_tz,
    purpose,
    familyDays,
    minEffect,
    selectedIds.join(","),
  ].join("|");
  const activeResults = resultState?.key === comparisonKey ? resultState.rows : null;
  const shared = activeResults ? buildSharedWindows(activeResults) : [];

  function toggleProfile(profileId: string) {
    setSelectedIds((current) => {
      if (current.includes(profileId)) return current.filter((id) => id !== profileId);
      if (current.length >= FAMILY_PROFILE_LIMIT) return current;
      return [...current, profileId];
    });
  }

  async function compareFamily() {
    const requests = selectedProfiles
      .map((profile) => ({ profile, request: requestFromProfile(profile, date, location) }))
      .filter((item): item is { profile: SavedProfile; request: ScheduleRequest } => Boolean(item.request));
    if (requests.length < 2) return;

    setComparing(true);
    setResultState(null);
    const settled = await Promise.allSettled(
      requests.map(({ request }) => fetchMuhurta(toMuhurtaRequest(request, date, location, purpose, familyDays, minEffect))),
    );
    setResultState({
      key: comparisonKey,
      rows: settled.map((result, index) => ({
        profile: requests[index].profile,
        response: result.status === "fulfilled" ? result.value : null,
        failed: result.status === "rejected",
      })),
    });
    setComparing(false);
  }

  return (
    <section
      className="rounded-xl border border-black/10 bg-white/25 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.03]"
      data-testid="muhurta-family-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-accent">{dict.muhurta.familyTitle}</p>
          <p className="mt-1 max-w-2xl text-sm opacity-75">{dict.muhurta.familyDescription}</p>
        </div>
        <span className="rounded-full border border-black/10 px-3 py-1 text-xs opacity-75 dark:border-white/10">
          {dict.muhurta.familySelectedCount.replace("{count}", String(selectedProfiles.length))}
        </span>
      </div>

      {loadingProfiles ? (
        <p className="mt-4 rounded-lg border border-black/10 p-3 text-sm opacity-75 dark:border-white/10">
          {dict.ui.loading}
        </p>
      ) : profiles.length === 0 ? (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-semibold">{dict.muhurta.familyEmptyTitle}</p>
          <p className="mt-1 opacity-80">{dict.muhurta.familyEmptyBody}</p>
          <Link
            href={`/${locale}/birth-nakshatra`}
            className="mt-3 inline-flex rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            {dict.muhurta.familyCreateProfile}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {visibleProfiles.map((profile) => {
              const selected = selectedIds.includes(profile.id);
              return (
                <button
                  key={profile.id}
                  type="button"
                  aria-pressed={selected}
                  data-testid="muhurta-family-profile"
                  onClick={() => toggleProfile(profile.id)}
                  className={`min-w-0 rounded-lg border px-3 py-2 text-left transition ${
                    selected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-black/10 hover:border-accent/40 dark:border-white/10"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold">{profile.label}</span>
                  <span className="mt-0.5 block truncate text-xs opacity-70">{profileIdentityText(profile, dict)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="muhurta-family-compare"
              disabled={selectedProfiles.length < 2 || comparing}
              onClick={compareFamily}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {comparing ? dict.muhurta.familyLoading : dict.muhurta.familyCompare}
            </button>
            <p className="text-xs opacity-70">
              {selectedProfiles.length < 2
                ? dict.muhurta.familyNeedTwo
                : dict.muhurta.familyDaysNote.replace("{count}", String(familyDays))}
            </p>
          </div>

          {validProfiles.length > FAMILY_PROFILE_LIMIT ? (
            <p className="mt-2 text-xs opacity-70">
              {dict.muhurta.familyProfileLimit.replace("{count}", String(FAMILY_PROFILE_LIMIT))}
            </p>
          ) : null}

          {activeResults && (
            <div className="mt-5 flex flex-col gap-3">
              {shared.length ? (
                <>
                  <p className="text-sm font-semibold">{dict.muhurta.familySharedTitle}</p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {shared.map((window) => (
                      <article
                        key={`${window.starts_at}-${window.ends_at}-${window.score}`}
                        data-testid="muhurta-family-shared-window"
                        className="rounded-lg border border-black/10 bg-background p-3 text-sm dark:border-white/10"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{formatDate(window.effective_date, locale)}</p>
                            <p className="mt-1 text-lg font-bold tabular-nums">
                              {formatTime(window.starts_at, locale)} - {formatTime(window.ends_at, locale)}
                            </p>
                            <p className="mt-1 text-xs opacity-70">{durationText(window.duration_seconds, dict)}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${GRADE_STYLE[window.grade]}`}>
                            {dict.muhurta.grades[window.grade]}
                          </span>
                        </div>
                        <p className="mt-3 text-xs font-semibold uppercase opacity-60">
                          {dict.muhurta.familyIncludedProfiles}
                        </p>
                        <p className="mt-1 text-xs opacity-80">{window.profiles.map((profile) => profile.label).join(", ")}</p>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    {dict.muhurta.familyNoCommon}
                  </p>
                  <p className="text-sm font-semibold">{dict.muhurta.familyIndividualFallback}</p>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {activeResults.map((row) => {
                      const window = bestIndividualWindow(row.response);
                      return (
                        <article
                          key={row.profile.id}
                          data-testid="muhurta-family-individual-window"
                          className="rounded-lg border border-black/10 bg-background p-3 text-sm dark:border-white/10"
                        >
                          <p className="font-semibold">{row.profile.label}</p>
                          {row.failed || !window ? (
                            <p className="mt-2 text-xs opacity-75">{dict.muhurta.familyLoadFailed}</p>
                          ) : (
                            <>
                              <p className="mt-2 text-xs uppercase opacity-60">{dict.muhurta.familyBestIndividual}</p>
                              <p className="mt-1 font-semibold">{formatDate(window.effective_date, locale)}</p>
                              <p className="mt-1 text-lg font-bold tabular-nums">
                                {formatTime(window.starts_at, locale)} - {formatTime(window.ends_at, locale)}
                              </p>
                              <span
                                className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${GRADE_STYLE[window.grade]}`}
                              >
                                {dict.muhurta.grades[window.grade]}
                              </span>
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MuhurtaMonthPanel({
  request,
  date,
  location,
  purpose,
  minEffect,
  locale,
  dict,
  onUseDate,
}: {
  request: ScheduleRequest;
  date: string;
  location: LocationValue;
  purpose: MuhurtaPurpose;
  minEffect: "good" | "very_good";
  locale: string;
  dict: Dictionary;
  onUseDate: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => monthFromDate(date));
  const [selectedDate, setSelectedDate] = useState(date);
  const [data, setData] = useState<MuhurtaMonthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (nextMonth: { year: number; month: number }, preferredDate?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMuhurtaMonth(
          toMuhurtaMonthRequest(request, nextMonth.year, nextMonth.month, location, purpose, minEffect),
        );
        setData(result);
        const preferred = preferredDate && result.days.some((day) => day.date === preferredDate) ? preferredDate : null;
        setSelectedDate(
          preferred ??
            result.days.find((day) => day.best_grade === "excellent")?.date ??
            result.days.find((day) => day.window_count > 0)?.date ??
            result.days[0]?.date ??
            "",
        );
      } catch (e) {
        setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
      } finally {
        setLoading(false);
      }
    },
    [dict.ui.error, location, minEffect, purpose, request],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) void run(month, date);
    })();
    return () => {
      cancelled = true;
    };
  }, [date, month, run]);

  const selectedDay = useMemo(
    () => data?.days.find((day) => day.date === selectedDate) ?? data?.days.find((day) => day.window_count > 0) ?? data?.days[0] ?? null,
    [data, selectedDate],
  );

  function onMonthChange(nextMonth: { year: number; month: number }) {
    setMonth(nextMonth);
  }

  return (
    <div className="flex flex-col gap-5" data-testid="muhurta-month-panel">
      <section className="rounded-xl border border-black/10 bg-white/25 p-4 dark:border-white/10 dark:bg-white/[.03]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-accent">{dict.muhurta.monthTitle}</p>
            <h2 className="mt-1 text-xl font-semibold">{formatMonthName(month.year, month.month, locale)}</h2>
            <p className="mt-1 text-sm opacity-75">{dict.muhurta.monthDescription}</p>
          </div>
          <MonthControls month={month} onChange={onMonthChange} dict={dict} locale={locale} />
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => run(month, selectedDate)}
            className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-white"
          >
            {dict.ui.retry}
          </button>
        </div>
      )}

      {loading && !data && (
        <div role="status" className="grid gap-2 md:grid-cols-7">
          <span className="sr-only">{dict.ui.loading}</span>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg border border-black/10 motion-safe:animate-pulse dark:border-white/10" />
          ))}
        </div>
      )}

      {data && !error && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <p className="text-xs opacity-70">{data.location.name}</p>
              {loading ? <p className="text-xs opacity-70">{dict.muhurta.monthRefreshing}</p> : null}
            </div>
            <MuhurtaMonthGrid
              days={data.days}
              selectedDate={selectedDay?.date ?? selectedDate}
              onSelect={setSelectedDate}
              locale={locale}
              dict={dict}
            />
            <MuhurtaMonthMobileList
              days={data.days}
              selectedDate={selectedDay?.date ?? selectedDate}
              onSelect={setSelectedDate}
              locale={locale}
              dict={dict}
            />
          </section>

          <MuhurtaMonthSelectedDay day={selectedDay} locale={locale} dict={dict} onUseDate={onUseDate} />
        </div>
      )}
    </div>
  );
}

function MonthControls({
  month,
  onChange,
  dict,
  locale,
}: {
  month: { year: number; month: number };
  onChange: (month: { year: number; month: number }) => void;
  dict: Dictionary;
  locale: string;
}) {
  const display = formatMonthName(month.year, month.month, locale);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        aria-label={dict.muhurta.monthPrevious}
        onClick={() => onChange(shiftMonth(month.year, month.month, -1))}
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        {"<"}
      </button>
      <label className="relative rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium dark:border-white/20">
        <span>{display}</span>
        <input
          type="month"
          value={monthInputValue(month.year, month.month)}
          min="1800-01"
          max="2399-12"
          onChange={(e) => {
            if (!e.target.value) return;
            const [year, nextMonth] = e.target.value.split("-").map(Number);
            onChange({ year, month: nextMonth });
          }}
          aria-label={dict.muhurta.monthPick}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <button
        type="button"
        aria-label={dict.muhurta.monthNext}
        onClick={() => onChange(shiftMonth(month.year, month.month, 1))}
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        {">"}
      </button>
    </div>
  );
}

function MuhurtaMonthGrid({
  days,
  selectedDate,
  onSelect,
  locale,
  dict,
}: {
  days: MuhurtaMonthDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
  locale: string;
  dict: Dictionary;
}) {
  const firstDate = new Date(`${days[0].date}T12:00:00`);
  const leadingBlanks = firstDate.getDay();
  const weekdayFormatter = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", { weekday: "short" });
  const weekdayHeaders = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(2026, 1, 1 + i)));
  return (
    <div data-testid="muhurta-month-grid" className="hidden md:flex md:flex-col md:gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase opacity-60">
        {weekdayHeaders.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}
        {days.map((day) => (
          <MuhurtaMonthDayCell
            key={day.date}
            day={day}
            selected={day.date === selectedDate}
            onSelect={onSelect}
            locale={locale}
            dict={dict}
          />
        ))}
      </div>
    </div>
  );
}

function monthDayTone(day: MuhurtaMonthDay): string {
  if (day.best_grade) return GRADE_STYLE[day.best_grade];
  if (day.is_poya_day) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-black/10 bg-white/20 dark:border-white/10 dark:bg-white/[.03]";
}

function MuhurtaMonthDayCell({
  day,
  selected,
  onSelect,
  locale,
  dict,
}: {
  day: MuhurtaMonthDay;
  selected: boolean;
  onSelect: (date: string) => void;
  locale: string;
  dict: Dictionary;
}) {
  const title = `${formatLongDate(day.date, locale)} ${dict.muhurta.monthWindowCount.replace(
    "{count}",
    String(day.window_count),
  )}`;
  return (
    <button
      type="button"
      data-testid={day.is_poya_day ? "muhurta-month-poya" : "muhurta-month-day"}
      title={title}
      aria-label={title}
      onClick={() => onSelect(day.date)}
      className={`flex min-h-28 min-w-0 flex-col rounded-lg border p-2 text-left transition hover:border-accent/70 ${monthDayTone(
        day,
      )} ${selected ? "ring-2 ring-accent" : ""}`}
    >
      <span className="text-base font-semibold tabular-nums">{Number(day.date.slice(8))}</span>
      <span className="mt-1 text-[11px] font-medium leading-snug">{dict.moonCalendar.phaseLabels[day.moon_phase]}</span>
      <span className="mt-1 text-xs opacity-80">
        {day.best_grade ? dict.muhurta.grades[day.best_grade] : dict.muhurta.monthNoWindowsShort}
      </span>
      <span className="mt-1 text-[11px] opacity-70">
        {dict.muhurta.monthWindowCount.replace("{count}", String(day.window_count))}
      </span>
      {day.is_poya_day && (
        <span className="mt-auto w-fit rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold">
          {dict.moonCalendar.poyaShort}
        </span>
      )}
    </button>
  );
}

function MuhurtaMonthMobileList({
  days,
  selectedDate,
  onSelect,
  locale,
  dict,
}: {
  days: MuhurtaMonthDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
  locale: string;
  dict: Dictionary;
}) {
  return (
    <div data-testid="muhurta-month-mobile-list" className="flex flex-col gap-2 md:hidden">
      {days.map((day) => (
        <button
          key={day.date}
          type="button"
          data-testid={day.is_poya_day ? "muhurta-month-poya" : "muhurta-month-day"}
          onClick={() => onSelect(day.date)}
          className={`rounded-lg border p-3 text-left ${monthDayTone(day)} ${
            day.date === selectedDate ? "ring-2 ring-accent" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{formatLongDate(day.date, locale)}</p>
              <p className="mt-1 text-sm opacity-75">
                {day.best_grade ? dict.muhurta.grades[day.best_grade] : dict.muhurta.monthNoWindowsShort}
              </p>
              <p className="mt-1 text-xs opacity-70">
                {dict.muhurta.monthWindowCount.replace("{count}", String(day.window_count))}
              </p>
            </div>
            {day.is_poya_day && (
              <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold">
                {dict.moonCalendar.poyaShort}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function MuhurtaMonthSelectedDay({
  day,
  locale,
  dict,
  onUseDate,
}: {
  day: MuhurtaMonthDay | null;
  locale: string;
  dict: Dictionary;
  onUseDate: (date: string) => void;
}) {
  if (!day) return null;
  return (
    <aside
      data-testid="muhurta-month-selected-day"
      className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.04] xl:sticky xl:top-4 xl:self-start"
    >
      <p className="text-xs font-semibold uppercase text-accent">{dict.muhurta.monthSelectedDay}</p>
      <h2 className="mt-1 text-lg font-semibold">{formatLongDate(day.date, locale)}</h2>
      <dl className="mt-4 grid gap-3 text-sm">
        <Fact label={dict.panchanga.sinhalaMonth} value={sinhalaMonthName(dict, day.sinhala_month.key)} />
        <Fact label={dict.moonCalendar.moonPhase} value={dict.moonCalendar.phaseLabels[day.moon_phase]} />
        <Fact label={dict.muhurta.monthWindows} value={String(day.window_count)} />
      </dl>
      {day.is_poya_day && day.poya ? (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          {sinhalaMonthName(dict, day.poya.month_key)} {dict.moonCalendar.poyaShort}
        </p>
      ) : null}
      {day.top_windows.length ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm font-semibold">{dict.muhurta.monthTopWindows}</p>
          {day.top_windows.map((window) => (
            <article key={`${window.starts_at}-${window.ends_at}-${window.score}`} className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold tabular-nums">
                    {formatTime(window.starts_at, locale)} - {formatTime(window.ends_at, locale)}
                  </p>
                  <p className="mt-1 text-xs opacity-70">
                    {durationText(window.duration_seconds, dict)} - {translateEnum(dict, "activities", window.pancha_pakshi_activity)}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${GRADE_STYLE[window.grade]}`}>
                  {dict.muhurta.grades[window.grade]}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {dict.muhurta.monthNoWindows}
        </p>
      )}
      <button
        type="button"
        data-testid="muhurta-month-use-date"
        onClick={() => onUseDate(day.date)}
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
      >
        {dict.muhurta.monthUseDate}
      </button>
      <Link
        href={`/${locale}/daily-guide?date=${day.date}`}
        className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent dark:border-white/20"
      >
        {dict.muhurta.openDailyGuide}
      </Link>
    </aside>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-black/10 pb-2 last:border-0 dark:border-white/10">
      <dt className="text-xs uppercase opacity-60">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function MuhurtaClient() {
  const { dict, locale } = useLocale();
  const [identityRequest, setIdentityRequest] = useState<ScheduleRequest | null>(null);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [date, setDate] = useState("");
  const [activeView, setActiveView] = useState<"recommendations" | "month">("recommendations");
  const [purpose, setPurpose] = useState<MuhurtaPurpose>("general");
  const [days, setDays] = useState(7);
  const [minEffect, setMinEffect] = useState<"good" | "very_good">("good");
  const [data, setData] = useState<MuhurtaSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedDefaults, setUsedDefaults] = useState(false);

  const run = useCallback(
    async (
      baseRequest: ScheduleRequest,
      nextDate: string,
      nextLocation: LocationValue,
      nextPurpose = purpose,
      nextDays = days,
      nextMinEffect = minEffect,
    ) => {
      setIdentityRequest(baseRequest);
      setDate(nextDate);
      setLocation(nextLocation);
      setLoading(true);
      setError(null);
      try {
        const result = await fetchMuhurta(
          toMuhurtaRequest(baseRequest, nextDate, nextLocation, nextPurpose, nextDays, nextMinEffect),
        );
        setData(result);
      } catch (e) {
        setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
      } finally {
        setLoading(false);
      }
    },
    [days, dict.ui.error, minEffect, purpose],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initial = await resolveDefaultScheduleRequest();
      if (cancelled) return;
      const initialLocation = locationFromRequest(initial);
      setUsedDefaults(true);
      void run(initial, initial.target_date, initialLocation);
    })();
    return () => {
      cancelled = true;
    };
  }, [run]);

  const currentBird = useMemo(() => {
    if (identityRequest?.method === "bird") return identityRequest.bird;
    return data?.birth_bird ?? "peacock";
  }, [data?.birth_bird, identityRequest]);

  function rerun(next: {
    request?: ScheduleRequest;
    date?: string;
    location?: LocationValue;
    purpose?: MuhurtaPurpose;
    days?: number;
    minEffect?: "good" | "very_good";
  }) {
    const nextLocation = next.location ?? location ?? mostRecentLocation() ?? DEFAULT_LOCATION;
    const nextDate = next.date ?? (date || todayFor(nextLocation));
    const nextRequest =
      next.request ??
      identityRequest ??
      ({
        method: "bird",
        bird: "peacock",
        target_date: nextDate,
        target_time: "12:00:00",
        location_name: nextLocation.name,
        latitude: nextLocation.latitude,
        longitude: nextLocation.longitude,
        iana_tz: nextLocation.iana_tz,
      } satisfies ScheduleRequest);
    const alignedRequest = {
      ...nextRequest,
      target_date: nextDate,
      target_time: "12:00:00",
      location_name: nextLocation.name,
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude,
      iana_tz: nextLocation.iana_tz,
    } as ScheduleRequest;
    setUsedDefaults(false);
    void run(
      alignedRequest,
      nextDate,
      nextLocation,
      next.purpose ?? purpose,
      next.days ?? days,
      next.minEffect ?? minEffect,
    );
  }

  const topWindows = data?.windows.slice(0, 8) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold">{resolveKey(dict, feature.titleKey)}</h1>
        <p className="mt-1 text-sm opacity-80 sm:text-base">{resolveKey(dict, feature.descriptionKey)}</p>
      </header>

      <div className="flex w-fit rounded-lg border border-black/10 bg-white/30 p-1 text-sm dark:border-white/10 dark:bg-white/[.03]" data-testid="muhurta-view-tabs">
        {(["recommendations", "month"] as const).map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={activeView === view}
            onClick={() => setActiveView(view)}
            className={`rounded-md px-3 py-1.5 font-medium transition ${
              activeView === view ? "bg-accent text-white" : "opacity-75 hover:opacity-100"
            }`}
          >
            {view === "recommendations" ? dict.muhurta.viewRecommendations : dict.muhurta.viewMonth}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <aside
          className="rounded-xl border border-black/10 bg-white/35 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.03]"
          data-testid="muhurta-controls"
        >
          <h2 className="text-sm font-semibold uppercase text-accent">{dict.muhurta.controlsTitle}</h2>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase opacity-60">{dict.muhurta.purpose}</p>
              <div className="grid grid-cols-1 gap-2">
                {PURPOSES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setPurpose(item);
                      rerun({ purpose: item });
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      purpose === item
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-black/10 hover:border-accent/40 dark:border-white/10"
                    }`}
                  >
                    {dict.muhurta.purposes[item]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase opacity-60">{dict.ui.birthBird}</p>
              <div className="grid grid-cols-5 gap-2">
                {BIRDS.map((bird) => {
                  const Icon = BIRD_ICONS[bird];
                  return (
                    <button
                      key={bird}
                      type="button"
                      title={translateEnum(dict, "birds", bird)}
                      aria-label={translateEnum(dict, "birds", bird)}
                      onClick={() => {
                        const loc = location ?? DEFAULT_LOCATION;
                        const nextDate = date || todayFor(loc);
                        rerun({ request: withBird(identityRequest, bird, nextDate, loc) });
                      }}
                      className={`flex aspect-square items-center justify-center rounded-lg border text-2xl transition ${
                        currentBird === bird
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-black/10 hover:border-accent/40 dark:border-white/10"
                      }`}
                    >
                      <Icon />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase opacity-60">{dict.muhurta.startDate}</p>
              {date ? <DateNav date={date} onChange={(nextDate) => rerun({ date: nextDate })} /> : null}
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">{dict.muhurta.searchDays}</span>
              <select
                value={days}
                onChange={(e) => {
                  const nextDays = Number(e.target.value);
                  setDays(nextDays);
                  rerun({ days: nextDays });
                }}
                className="rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20"
              >
                {[1, 3, 5, 7, 10, 14].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="opacity-70">{dict.muhurta.minimumStrength}</span>
              <select
                value={minEffect}
                onChange={(e) => {
                  const nextMinEffect = e.target.value as "good" | "very_good";
                  setMinEffect(nextMinEffect);
                  rerun({ minEffect: nextMinEffect });
                }}
                className="rounded-lg border border-black/10 bg-transparent px-3 py-2 dark:border-white/20"
              >
                <option value="good">{translateEnum(dict, "effects", "good")}</option>
                <option value="very_good">{translateEnum(dict, "effects", "very_good")}</option>
              </select>
            </label>

            <LocationPicker value={location} onChange={(nextLocation) => rerun({ location: nextLocation })} />
          </div>
        </aside>

        <section className="min-w-0">
          {usedDefaults && !loading && data && (
            <p className="mb-3 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs">
              {dict.ui.showingFor}: {translateEnum(dict, "birds", data.birth_bird)} - {data.location.name}
            </p>
          )}

          {loading && (
            <p className="rounded-lg border border-black/10 p-4 text-sm opacity-80 dark:border-white/10">
              {dict.ui.loading}
            </p>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => rerun({})}
                className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-white"
              >
                {dict.ui.retry}
              </button>
            </div>
          )}

          {data && !loading && !error && activeView === "recommendations" && (
            <div data-testid="muhurta-result" className="flex flex-col gap-5">
              <section className="rounded-xl border border-black/10 bg-white/25 p-4 dark:border-white/10 dark:bg-white/[.03]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-60">{dict.muhurta.summaryTitle}</p>
                    <p className="mt-1 text-lg font-semibold">
                      {dict.muhurta.foundWindows.replace("{count}", String(data.windows.length))}
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/daily-guide`}
                    className="rounded-lg border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                  >
                    {dict.muhurta.openDailyGuide}
                  </Link>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="muhurta-day-summary">
                  {data.per_day.map((day) => (
                    <div key={day.date} className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
                      <p className="font-medium">{formatDate(day.date, locale)}</p>
                      <p className="mt-1 text-xs opacity-70">
                        {day.window_count} {dict.muhurta.windows}
                      </p>
                      <p className="text-xs opacity-70">{durationText(day.total_seconds, dict)}</p>
                    </div>
                  ))}
                </div>
              </section>

              {date && location ? (
                <FamilyMuhurtaPanel
                  date={date}
                  location={location}
                  purpose={purpose}
                  days={days}
                  minEffect={minEffect}
                  locale={locale}
                  dict={dict}
                />
              ) : null}

              {topWindows.length ? (
                <section className="flex flex-col gap-3" data-testid="muhurta-windows">
                  {topWindows.map((window) => (
                    <WindowCard key={`${window.starts_at}-${window.ends_at}-${window.score}`} window={window} />
                  ))}
                </section>
              ) : (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                  {dict.muhurta.noWindows}
                </p>
              )}
            </div>
          )}

          {data && !loading && !error && activeView === "month" && identityRequest && location && date && (
            <MuhurtaMonthPanel
              request={identityRequest}
              date={date}
              location={location}
              purpose={purpose}
              minEffect={minEffect}
              locale={locale}
              dict={dict}
              onUseDate={(nextDate) => {
                setActiveView("recommendations");
                rerun({ date: nextDate });
              }}
            />
          )}
        </section>
      </div>
    </div>
  );

  function WindowCard({ window }: { window: MuhurtaWindow }) {
    return (
      <article className="rounded-xl border border-black/10 bg-white/35 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.03]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{formatDate(window.effective_date, locale)}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">
              {formatTime(window.starts_at, locale)} - {formatTime(window.ends_at, locale)}
            </p>
            <p className="mt-1 text-xs opacity-70">
              {durationText(window.duration_seconds, dict)} - {translateEnum(dict, "activities", window.pancha_pakshi_activity)}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${GRADE_STYLE[window.grade]}`}>
            {dict.muhurta.grades[window.grade]}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {window.reasons.map((reason) => (
            <span key={reason} className="rounded-full border border-black/10 px-2 py-1 dark:border-white/10">
              {sourceLabel(reason, dict)}
            </span>
          ))}
        </div>

        <div
          data-testid="muhurta-source-overlaps"
          className="mt-3 rounded-lg border border-black/10 bg-background p-3 text-xs dark:border-white/10"
        >
          <p className="font-semibold uppercase opacity-60">{dict.muhurta.sourceOverlapsTitle}</p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {window.source_overlaps.map((overlap, i) => (
              <p key={`${overlap.source}-${overlap.starts_at}-${i}`} className="min-w-0">
                <span className="font-medium">{sourceLabel(overlap.source, dict)}</span>{" "}
                <span className="tabular-nums opacity-75">
                  {formatTime(overlap.starts_at, locale)}-{formatTime(overlap.ends_at, locale)}
                </span>
              </p>
            ))}
          </div>
        </div>

        {window.cautions.length ? (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            {window.cautions.map((caution) => (
              <p key={caution.key}>
                {dict.muhurta.cautions[caution.key]}: {cautionValue(caution, dict)}
              </p>
            ))}
          </div>
        ) : null}
      </article>
    );
  }
}

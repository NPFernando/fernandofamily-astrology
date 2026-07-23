"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EFFECT_COLORS } from "@fernandofamily/design-system";
import {
  ApiError,
  fetchMuhurta,
  fetchPanchanga,
  fetchSchedule,
  fetchScheduleWithServerTime,
  type DailyPanchanga,
  type MuhurtaGrade,
  type ScheduleRequest,
  type ScheduleResponse,
  type SubPeriod,
} from "@/lib/api-client";
import {
  FAMILY_ALMANAC_DAYS,
  FAMILY_ALMANAC_PROFILE_LIMIT,
  addDays,
  bestPanchaWindows,
  individualWindowsForDay,
  locationFromRequest,
  muhurtaRequestFromProfile,
  scheduleRequestFromProfile,
  sharedWindowsForDay,
  targetTimeFor,
  todayFor,
  validDateParam,
  withDateLocation,
  type FamilyMuhurtaResult,
} from "@/lib/family-almanac";
import { getDictionary, nakshatraName, translateEnum } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";
import { listProfiles, mergeLocalToServerOnce, type SavedProfile } from "@/lib/profiles";
import { useSessionProbe } from "@/lib/use-session-probe";
import { DateNav } from "@/components/pancha-pakshi/DateNav";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { DailyTimingTimeline } from "@/components/panchanga/DailyTimingTimeline";
import { PoyaDetailCard } from "@/components/panchanga/PoyaDetailCard";
import { FamilyAlmanacIcon, MoonCalendarIcon } from "@/components/icons/features";
import { BIRD_ICONS } from "@/components/icons/birds";
import { FullMoonIcon } from "@/components/icons/moon";

type Dictionary = ReturnType<typeof getDictionary>;

type AlmanacData = {
  panchanga: DailyPanchanga;
  schedule: ScheduleResponse;
  serverTime: Date | null;
  fetchedAtClientMs: number;
  referenceAt: string;
};

type FamilyScheduleResult = {
  profile: SavedProfile;
  schedule: ScheduleResponse | null;
  failed: boolean;
};

type FamilyData = {
  key: string;
  scheduleRows: FamilyScheduleResult[];
  muhurtaRows: FamilyMuhurtaResult[];
  panchangaDays: DailyPanchanga[];
};

const GRADE_STYLE: Record<MuhurtaGrade, string> = {
  excellent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  good: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  usable: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
};

function formatDate(isoDate: string, locale: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(isoDate: string, locale: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationText(seconds: number, dict: Dictionary) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${dict.muhurta.minutes}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ${dict.muhurta.hours} ${rest} ${dict.muhurta.minutes}` : `${hours} ${dict.muhurta.hours}`;
}

function sinhalaMonthName(dict: Dictionary, key: string): string {
  const isAdhi = key.startsWith("adhi-");
  const baseKey = isAdhi ? key.slice(5) : key;
  const baseName = translateEnum(dict, "sinhalaMonths", baseKey);
  return isAdhi ? `${dict.panchanga.adhiPrefix} ${baseName}` : baseName;
}

function offsetSuffix(iso: string): string {
  return iso.endsWith("Z") ? "Z" : iso.slice(-6);
}

function requestReferenceIso(request: ScheduleRequest, panchanga: DailyPanchanga): string {
  return `${request.target_date}T${request.target_time}${offsetSuffix(panchanga.sunrise)}`;
}

function defaultRequest(date: string, location: LocationValue): ScheduleRequest {
  return {
    method: "bird",
    bird: "peacock",
    target_date: date,
    target_time: targetTimeFor(date, location),
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
  };
}

function profileIdentityText(profile: SavedProfile, dict: Dictionary, locale: "en" | "si") {
  if (profile.bird) return translateEnum(dict, "birds", profile.bird);
  if (profile.nakshatra_index != null && profile.paksha) {
    return `${nakshatraName(profile.nakshatra_index, locale)} · ${translateEnum(dict, "paksha", profile.paksha)}`;
  }
  return dict.familyAlmanac.profileIncomplete;
}

function currentPeriodLabel(period: SubPeriod, dict: Dictionary) {
  return `${translateEnum(dict, "birds", period.main_bird)} · ${translateEnum(dict, "activities", period.main_activity)}`;
}

export function FamilyAlmanacClient() {
  const { dict, locale } = useLocale();
  const searchParams = useSearchParams();
  const requestedDate = validDateParam(searchParams.get("date"));
  const session = useSessionProbe();

  const [request, setRequest] = useState<ScheduleRequest | null>(null);
  const [date, setDate] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [data, setData] = useState<AlmanacData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);

  const run = useCallback(
    async (nextRequest: ScheduleRequest) => {
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
    },
    [dict.ui.error],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initialLocation = mostRecentLocation() ?? DEFAULT_LOCATION;
      const initialDate = requestedDate ?? todayFor(initialLocation).date;
      if (!cancelled) void run(defaultRequest(initialDate, initialLocation));
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedDate, run]);

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
        const kept = current.filter((id) => validIds.includes(id)).slice(0, FAMILY_ALMANAC_PROFILE_LIMIT);
        return kept.length ? kept : validIds.slice(0, FAMILY_ALMANAC_PROFILE_LIMIT);
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

  const validProfiles = useMemo(
    () => profiles.filter((profile) => Boolean(location && date && scheduleRequestFromProfile(profile, date, location))),
    [date, location, profiles],
  );
  const visibleProfiles = validProfiles.slice(0, FAMILY_ALMANAC_PROFILE_LIMIT);
  const selectedProfiles = useMemo(
    () => validProfiles.filter((profile) => selectedIds.includes(profile.id)),
    [selectedIds, validProfiles],
  );
  const familyKey = useMemo(
    () =>
      [
        date,
        location?.name,
        location?.latitude,
        location?.longitude,
        location?.iana_tz,
        selectedProfiles.map((profile) => profile.id).join(","),
      ].join("|"),
    [date, location, selectedProfiles],
  );

  useEffect(() => {
    if (!date || !location || loadingProfiles || selectedProfiles.length === 0) {
      return;
    }

    let cancelled = false;
    (async () => {
      setFamilyLoading(true);
      setFamilyData(null);
      const scheduleInputs = selectedProfiles
        .map((profile) => ({ profile, request: scheduleRequestFromProfile(profile, date, location) }))
        .filter((item): item is { profile: SavedProfile; request: ScheduleRequest } => Boolean(item.request));
      const muhurtaInputs = selectedProfiles
        .map((profile) => ({ profile, request: muhurtaRequestFromProfile(profile, date, location) }))
        .filter((item): item is { profile: SavedProfile; request: NonNullable<ReturnType<typeof muhurtaRequestFromProfile>> } =>
          Boolean(item.request),
        );

      const panchangaRequests = Array.from({ length: FAMILY_ALMANAC_DAYS }, (_, index) => addDays(date, index)).map(
        (day) =>
          fetchPanchanga({
            date: day,
            location_name: location.name,
            latitude: location.latitude,
            longitude: location.longitude,
            iana_tz: location.iana_tz,
          }),
      );
      const [scheduleSettled, muhurtaSettled, panchangaSettled] = await Promise.all([
        Promise.allSettled(scheduleInputs.map(({ request }) => fetchSchedule(request))),
        Promise.allSettled(muhurtaInputs.map(({ request }) => fetchMuhurta(request))),
        Promise.allSettled(panchangaRequests),
      ]);
      if (cancelled) return;
      setFamilyData({
        key: familyKey,
        scheduleRows: scheduleSettled.map((result, index) => ({
          profile: scheduleInputs[index].profile,
          schedule: result.status === "fulfilled" ? result.value : null,
          failed: result.status === "rejected",
        })),
        muhurtaRows: muhurtaSettled.map((result, index) => ({
          profile: muhurtaInputs[index].profile,
          windows: result.status === "fulfilled" ? result.value.windows : [],
          failed: result.status === "rejected",
        })),
        panchangaDays: panchangaSettled
          .map((result) => (result.status === "fulfilled" ? result.value : null))
          .filter((item): item is DailyPanchanga => Boolean(item)),
      });
      setFamilyLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setFamilyData({
          key: familyKey,
          scheduleRows: [],
          muhurtaRows: [],
          panchangaDays: [],
        });
        setFamilyLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [date, familyKey, loadingProfiles, location, selectedProfiles]);

  function changeDate(nextDate: string) {
    const loc = location ?? mostRecentLocation() ?? DEFAULT_LOCATION;
    const base = request ?? defaultRequest(nextDate, loc);
    void run(withDateLocation(base, nextDate, loc));
  }

  function changeLocation(nextLocation: LocationValue) {
    const nextDate = date || todayFor(nextLocation).date;
    const base = request ?? defaultRequest(nextDate, nextLocation);
    void run(withDateLocation(base, nextDate, nextLocation));
  }

  function toggleProfile(profileId: string) {
    setSelectedIds((current) => {
      if (current.includes(profileId)) return current.filter((id) => id !== profileId);
      if (current.length >= FAMILY_ALMANAC_PROFILE_LIMIT) return current;
      return [...current, profileId];
    });
  }

  const viewingToday = Boolean(location && date === todayFor(location).date);
  const currentPeriod = viewingToday ? data?.schedule.current_period ?? null : null;
  const bestWindows = useMemo(() => (data ? bestPanchaWindows(data.schedule, 3) : []), [data]);
  const activeFamilyData = familyData?.key === familyKey ? familyData : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FamilyAlmanacIcon className="text-3xl text-accent" />
          {dict.familyAlmanac.title}
        </h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">{dict.familyAlmanac.description}</p>
      </header>

      <section
        data-testid="family-almanac-controls"
        className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {dict.familyAlmanac.controlsTitle}
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <div className="flex flex-col gap-4">
            {date && <DateNav date={date} onChange={changeDate} />}
            <div>
              <p className="mb-2 text-sm opacity-70">{dict.ui.location}</p>
              <LocationPicker value={location} onChange={changeLocation} />
            </div>
          </div>
          <ProfileSelector
            dict={dict}
            locale={locale}
            profiles={visibleProfiles}
            totalValid={validProfiles.length}
            selectedIds={selectedIds}
            loading={loadingProfiles}
            onToggle={toggleProfile}
          />
        </div>
      </section>

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
        <div data-testid="family-almanac-result" className="flex flex-col gap-5">
          <section
            data-testid="family-almanac-summary"
            className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.03]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm opacity-70">{formatDate(data.panchanga.date, locale)}</p>
                <h2 className="mt-1 text-xl font-semibold">
                  {sinhalaMonthName(dict, data.panchanga.sinhala_month.key)}
                  {locale === "en" && ` ${dict.panchanga.sinhalaMonth}`}
                </h2>
                <p className="mt-1 text-sm opacity-80">
                  {data.schedule.location.name} · {translateEnum(dict, "paksha", data.panchanga.paksha)} ·{" "}
                  {dict.familyAlmanac.defaultBird.replace(
                    "{bird}",
                    translateEnum(dict, "birds", data.schedule.birth_bird),
                  )}
                </p>
              </div>
              <div className="flex flex-col gap-2 text-sm lg:items-end">
                {data.panchanga.is_poya_day && data.panchanga.poya ? (
                  <span
                    data-testid="family-almanac-poya-badge"
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 font-semibold"
                  >
                    <FullMoonIcon className="text-lg text-amber-600 dark:text-amber-400" />
                    {dict.panchanga.poyaTodayLabel} · {sinhalaMonthName(dict, data.panchanga.poya.month_key)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 opacity-75 dark:border-white/10">
                    <MoonCalendarIcon className="text-lg" />
                    {dict.dailyGuide.notPoya}
                  </span>
                )}
                <span className="rounded-full border border-black/10 px-3 py-1.5 opacity-75 dark:border-white/10">
                  {dict.familyAlmanac.selectedCount.replace("{count}", String(selectedProfiles.length))}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Fact
                label={dict.familyAlmanac.currentPeriod}
                value={currentPeriod ? currentPeriodLabel(currentPeriod, dict) : dict.dailyGuide.currentUnavailable}
              />
              <Fact
                label={dict.dailyGuide.avoidTitle}
                value={`${dict.panchanga.rahuKala}, ${dict.panchanga.yamaganda}, ${dict.panchanga.gulika}`}
              />
              <Fact
                label={dict.familyAlmanac.dishaShool}
                value={translateEnum(dict, "directions", data.schedule.disha_shool)}
              />
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
            testId="family-almanac-poya-detail"
          />

          <DailyTimingTimeline
            panchanga={data.panchanga}
            schedule={data.schedule}
            referenceAt={data.referenceAt}
            testId="family-almanac-timing-timeline"
          />

          <section
            data-testid="family-almanac-profile-cards"
            className="rounded-xl border border-black/10 bg-white/25 p-4 dark:border-white/10 dark:bg-white/[.03]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase text-accent">{dict.familyAlmanac.profileCardsTitle}</h2>
                <p className="mt-1 max-w-2xl text-sm opacity-75">{dict.familyAlmanac.profileCardsDescription}</p>
              </div>
              {familyLoading && <span className="text-xs opacity-70">{dict.familyAlmanac.refreshingFamily}</span>}
            </div>
            {selectedProfiles.length === 0 ? (
              <EmptyProfiles dict={dict} locale={locale} />
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(activeFamilyData?.scheduleRows ?? []).map((row) => (
                  <ProfileCard key={row.profile.id} row={row} dict={dict} locale={locale} />
                ))}
                {familyLoading &&
                  Array.from({ length: Math.max(selectedProfiles.length, 1) }).map((_, index) => (
                    <div
                      key={index}
                      className="min-h-44 rounded-lg border border-black/10 motion-safe:animate-pulse dark:border-white/10"
                    />
                  ))}
              </div>
            )}
          </section>

          <section
            data-testid="family-almanac-week"
            className="rounded-xl border border-black/10 bg-white/25 p-4 dark:border-white/10 dark:bg-white/[.03]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase text-accent">{dict.familyAlmanac.weekTitle}</h2>
                <p className="mt-1 max-w-2xl text-sm opacity-75">{dict.familyAlmanac.weekDescription}</p>
              </div>
              <span className="rounded-full border border-black/10 px-3 py-1 text-xs opacity-75 dark:border-white/10">
                {dict.familyAlmanac.weekRange.replace("{count}", String(FAMILY_ALMANAC_DAYS))}
              </span>
            </div>
            {selectedProfiles.length === 0 ? (
              <EmptyProfiles dict={dict} locale={locale} />
            ) : (
              <div className="mt-4 grid gap-3 xl:grid-cols-7">
                {Array.from({ length: FAMILY_ALMANAC_DAYS }, (_, index) => {
                  const day = addDays(date, index);
                  const panchanga = activeFamilyData?.panchangaDays.find((item) => item.date === day) ?? null;
                  return (
                    <WeekDayCard
                      key={day}
                      date={day}
                      panchanga={panchanga}
                      results={activeFamilyData?.muhurtaRows ?? []}
                      loading={familyLoading && !activeFamilyData}
                      dict={dict}
                      locale={locale}
                      onUseDate={changeDate}
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section
            data-testid="family-almanac-best-windows"
            className="rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-4"
          >
            <h2 className="text-sm font-semibold uppercase">{dict.familyAlmanac.defaultWindowsTitle}</h2>
            {bestWindows.length === 0 ? (
              <p className="mt-2 text-sm opacity-70">{dict.ui.noWindowsLeft}</p>
            ) : (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {bestWindows.map((period) => (
                  <PeriodPill key={period.id} period={period} dict={dict} locale={locale} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ProfileSelector({
  dict,
  locale,
  profiles,
  totalValid,
  selectedIds,
  loading,
  onToggle,
}: {
  dict: Dictionary;
  locale: "en" | "si";
  profiles: SavedProfile[];
  totalValid: number;
  selectedIds: string[];
  loading: boolean;
  onToggle: (profileId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase opacity-70">{dict.familyAlmanac.profileSelectorTitle}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-70">{dict.familyAlmanac.profileSelectorDescription}</p>
        </div>
        <span className="shrink-0 rounded-full border border-black/10 px-2.5 py-1 text-xs opacity-75 dark:border-white/10">
          {dict.familyAlmanac.selectedCount.replace("{count}", String(selectedIds.length))}
        </span>
      </div>

      {loading ? (
        <p className="mt-3 text-sm opacity-70">{dict.ui.loading}</p>
      ) : profiles.length === 0 ? (
        <EmptyProfiles dict={dict} locale={locale} />
      ) : (
        <>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {profiles.map((profile) => {
              const selected = selectedIds.includes(profile.id);
              const disabled = !selected && selectedIds.length >= FAMILY_ALMANAC_PROFILE_LIMIT;
              const Icon = profile.bird ? BIRD_ICONS[profile.bird] : null;
              return (
                <button
                  key={profile.id}
                  type="button"
                  data-testid="family-almanac-profile"
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={() => onToggle(profile.id)}
                  className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                    selected
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-black/10 hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10"
                  }`}
                >
                  {Icon && <Icon className="shrink-0 text-2xl" />}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{profile.label}</span>
                    <span className="mt-0.5 block truncate text-xs opacity-70">
                      {profileIdentityText(profile, dict, locale)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {totalValid > FAMILY_ALMANAC_PROFILE_LIMIT ? (
            <p className="mt-2 text-xs opacity-70">
              {dict.familyAlmanac.profileLimit.replace("{count}", String(FAMILY_ALMANAC_PROFILE_LIMIT))}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function EmptyProfiles({ dict, locale }: { dict: Dictionary; locale: "en" | "si" }) {
  return (
    <div
      data-testid="family-almanac-empty-profiles"
      className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
    >
      <p className="font-semibold">{dict.familyAlmanac.emptyTitle}</p>
      <p className="mt-1 opacity-80">{dict.familyAlmanac.emptyBody}</p>
      <Link
        href={`/${locale}/birth-nakshatra`}
        className="mt-3 inline-flex rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
      >
        {dict.familyAlmanac.createProfile}
      </Link>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-background p-3 dark:border-white/10">
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function ProfileCard({
  row,
  dict,
  locale,
}: {
  row: FamilyScheduleResult;
  dict: Dictionary;
  locale: "en" | "si";
}) {
  const best = row.schedule ? bestPanchaWindows(row.schedule, 1)[0] ?? null : null;
  const tara = row.schedule?.tara_bala ?? null;
  const chandrashtama = row.schedule?.chandrashtama ?? null;
  return (
    <article
      data-testid="family-almanac-person-card"
      className="min-w-0 rounded-lg border border-black/10 bg-background p-3 text-sm dark:border-white/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{row.profile.label}</h3>
          <p className="mt-0.5 truncate text-xs opacity-70">{profileIdentityText(row.profile, dict, locale)}</p>
        </div>
        {row.schedule?.birth_bird && BIRD_ICONS[row.schedule.birth_bird] ? (
          <span className="shrink-0 text-2xl">{BIRD_ICONS[row.schedule.birth_bird]({})}</span>
        ) : null}
      </div>
      {row.failed || !row.schedule ? (
        <p className="mt-3 text-xs opacity-75">{dict.familyAlmanac.loadFailed}</p>
      ) : (
        <div className="mt-3 grid gap-2">
          <MiniFact
            label={dict.familyAlmanac.taraBala}
            value={tara ? translateEnum(dict, "effects", tara.effect) : dict.familyAlmanac.taraUnavailable}
            tone={tara?.effect}
          />
          <MiniFact
            label={dict.familyAlmanac.chandrashtama}
            value={
              chandrashtama
                ? `${formatTime(chandrashtama.starts_at, locale)}-${formatTime(chandrashtama.ends_at, locale)}`
                : row.profile.moon_rashi_index == null
                  ? dict.familyAlmanac.chandrashtamaUnavailable
                  : dict.familyAlmanac.chandrashtamaClear
            }
          />
          <MiniFact
            label={dict.familyAlmanac.bestIndividualWindow}
            value={
              best
                ? `${formatTime(best.starts_at, locale)}-${formatTime(best.ends_at, locale)} · ${translateEnum(
                    dict,
                    "effects",
                    best.effect,
                  )}`
                : dict.ui.noWindowsLeft
            }
            tone={best?.effect}
          />
        </div>
      )}
    </article>
  );
}

function MiniFact({ label, value, tone }: { label: string; value: string; tone?: keyof typeof EFFECT_COLORS }) {
  return (
    <div className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10">
      <p className="text-[11px] font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-0.5 break-words text-xs font-semibold" style={{ color: tone ? EFFECT_COLORS[tone] : undefined }}>
        {value}
      </p>
    </div>
  );
}

function WeekDayCard({
  date,
  panchanga,
  results,
  loading,
  dict,
  locale,
  onUseDate,
}: {
  date: string;
  panchanga: DailyPanchanga | null;
  results: FamilyMuhurtaResult[];
  loading: boolean;
  dict: Dictionary;
  locale: "en" | "si";
  onUseDate: (date: string) => void;
}) {
  const shared = sharedWindowsForDay(results, date).slice(0, 1);
  const individual = shared.length ? [] : individualWindowsForDay(results, date).slice(0, 2);
  return (
    <article
      data-testid="family-almanac-week-day"
      className="min-h-[16rem] rounded-lg border border-black/10 bg-background p-3 text-sm dark:border-white/10"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{formatShortDate(date, locale)}</h3>
          {panchanga ? (
            <p className="mt-0.5 text-xs opacity-70">{sinhalaMonthName(dict, panchanga.sinhala_month.key)}</p>
          ) : (
            <p className="mt-0.5 text-xs opacity-70">{dict.ui.loading}</p>
          )}
        </div>
        {panchanga?.is_poya_day && (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold">
            {dict.panchanga.poyaTodayLabel}
          </span>
        )}
      </div>

      <div className="mt-3 min-h-32">
        {loading ? (
          <p className="text-xs opacity-70">{dict.familyAlmanac.refreshingFamily}</p>
        ) : shared.length ? (
          <div data-testid="family-almanac-shared-window" className="rounded-md border border-emerald-500/35 bg-emerald-500/10 p-2">
            <p className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
              {dict.familyAlmanac.sharedWindow}
            </p>
            <p className="mt-1 font-bold tabular-nums">
              {formatTime(shared[0].starts_at, locale)}-{formatTime(shared[0].ends_at, locale)}
            </p>
            <p className="mt-0.5 text-xs opacity-75">{durationText(shared[0].duration_seconds, dict)}</p>
            <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${GRADE_STYLE[shared[0].grade]}`}>
              {dict.muhurta.grades[shared[0].grade]}
            </span>
          </div>
        ) : individual.length ? (
          <div className="grid gap-2">
            <p className="text-[11px] font-semibold uppercase opacity-70">{dict.familyAlmanac.individualFallback}</p>
            {individual.map((item) => (
              <div
                key={`${item.profile.id}-${item.window.starts_at}`}
                data-testid="family-almanac-individual-window"
                className="rounded-md border border-black/10 p-2 dark:border-white/10"
              >
                <p className="truncate text-xs font-semibold">{item.profile.label}</p>
                <p className="mt-0.5 text-xs tabular-nums">
                  {formatTime(item.window.starts_at, locale)}-{formatTime(item.window.ends_at, locale)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs opacity-70">{dict.familyAlmanac.noWindows}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onUseDate(date)}
        className="mt-3 w-full rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent dark:border-white/20"
      >
        {dict.familyAlmanac.useDate}
      </button>
    </article>
  );
}

function PeriodPill({ period, dict, locale }: { period: SubPeriod; dict: Dictionary; locale: "en" | "si" }) {
  return (
    <div className="rounded-lg border border-black/10 bg-background p-3 text-sm dark:border-white/10">
      <p className="font-semibold" style={{ color: EFFECT_COLORS[period.effect] }}>
        {translateEnum(dict, "effects", period.effect)}
      </p>
      <p className="mt-1 text-xs opacity-75">
        {formatTime(period.starts_at, locale)}-{formatTime(period.ends_at, locale)}
      </p>
      <p className="mt-1 text-xs opacity-75">
        {translateEnum(dict, "birds", period.sub_bird)} · {translateEnum(dict, "activities", period.sub_activity)}
      </p>
    </div>
  );
}

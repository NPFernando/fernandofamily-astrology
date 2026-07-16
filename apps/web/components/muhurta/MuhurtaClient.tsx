"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { getDictionary, resolveKey, translateEnum } from "@/lib/i18n";
import {
  ApiError,
  fetchMuhurta,
  type BirdId,
  type MuhurtaGrade,
  type MuhurtaPurpose,
  type MuhurtaSearchRequest,
  type MuhurtaSearchResponse,
  type MuhurtaSource,
  type MuhurtaWindow,
  type ScheduleRequest,
} from "@/lib/api-client";
import { features } from "@/lib/feature-registry";
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
const PURPOSES: MuhurtaPurpose[] = ["general", "travel", "study_work", "purchase", "home_ritual"];
const GRADE_STYLE: Record<MuhurtaGrade, string> = {
  excellent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  good: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  usable: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

function todayFor(location: LocationValue): string {
  return nowAsTargetDateTime(location.iana_tz).date;
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

export function MuhurtaClient() {
  const { dict, locale } = useLocale();
  const [identityRequest, setIdentityRequest] = useState<ScheduleRequest | null>(null);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [date, setDate] = useState("");
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

          {data && !loading && !error && (
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

        {window.cautions.length ? (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            {window.cautions.map((caution) => (
              <p key={caution.key}>
                {dict.muhurta.cautions[caution.key]}: {translateEnum(dict, "directions", caution.value)}
              </p>
            ))}
          </div>
        ) : null}
      </article>
    );
  }
}

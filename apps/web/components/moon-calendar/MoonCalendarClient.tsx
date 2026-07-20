"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { getDictionary, translateEnum } from "@/lib/i18n";
import {
  ApiError,
  fetchPanchangaMonth,
  type MonthPanchanga,
  type MonthPanchangaDay,
  type MoonPhaseKey,
} from "@/lib/api-client";
import { loadAccountPreferences } from "@/lib/account-preferences";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { FullMoonIcon } from "@/components/icons/moon";
import { PoyaDetailCard } from "@/components/panchanga/PoyaDetailCard";

function sinhalaMonthName(dict: ReturnType<typeof getDictionary>, key: string): string {
  const isAdhi = key.startsWith("adhi-");
  const baseKey = isAdhi ? key.slice(5) : key;
  const baseName = translateEnum(dict, "sinhalaMonths", baseKey);
  return isAdhi ? `${dict.panchanga.adhiPrefix} ${baseName}` : baseName;
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

function todayIsoForLocation(loc: LocationValue): string {
  return nowAsTargetDateTime(loc.iana_tz).date;
}

function validDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

function formatDate(date: string, locale: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string | null, locale: string, fallback: string) {
  if (!iso) return fallback;
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function phaseTone(phase: MoonPhaseKey, isPoya: boolean): string {
  if (isPoya || phase === "full") return "border-amber-500/60 bg-amber-500/15";
  if (phase === "new") return "border-slate-500/40 bg-slate-500/10";
  if (phase.startsWith("waxing")) return "border-sky-500/40 bg-sky-500/10";
  return "border-violet-500/40 bg-violet-500/10";
}

export function MoonCalendarClient() {
  const { dict, locale } = useLocale();
  const searchParams = useSearchParams();
  const requestedDate = validDateParam(searchParams.get("date"));
  const [month, setMonth] = useState(() => monthFromDate(new Date().toISOString().slice(0, 10)));
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [data, setData] = useState<MonthPanchanga | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedDefaults, setUsedDefaults] = useState(false);

  const run = useCallback(
    async (nextMonth: { year: number; month: number }, loc: LocationValue, preferredDate?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPanchangaMonth({
          year: nextMonth.year,
          month: nextMonth.month,
          location_name: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          iana_tz: loc.iana_tz,
        });
        setData(result);
        const preferred = preferredDate && result.days.some((d) => d.date === preferredDate) ? preferredDate : null;
        setSelectedDate(preferred ?? result.days.find((d) => d.is_poya_day)?.date ?? result.days[0]?.date ?? null);
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
      const account = await loadAccountPreferences();
      if (cancelled) return;
      const loc = account.preferences?.default_location ?? mostRecentLocation() ?? DEFAULT_LOCATION;
      const targetDate = requestedDate ?? todayIsoForLocation(loc);
      const initialMonth = monthFromDate(targetDate);
      setLocation(loc);
      setMonth(initialMonth);
      setUsedDefaults(!requestedDate);
      void run(initialMonth, loc, targetDate);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedDate, run]);

  const selectedDay = useMemo(
    () => data?.days.find((d) => d.date === selectedDate) ?? data?.days[0] ?? null,
    [data, selectedDate],
  );

  const onMonthChange = useCallback(
    (next: { year: number; month: number }) => {
      setMonth(next);
      if (location) void run(next, location);
    },
    [location, run],
  );

  const onLocationChange = useCallback(
    (loc: LocationValue) => {
      setLocation(loc);
      setUsedDefaults(false);
      void run(month, loc, selectedDate ?? undefined);
    },
    [month, run, selectedDate],
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FullMoonIcon className="text-3xl text-accent" />
          {dict.moonCalendar.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed opacity-75">{dict.moonCalendar.description}</p>
      </header>

      <section
        aria-label={dict.moonCalendar.controlsTitle}
        data-testid="moon-calendar-controls"
        className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {dict.moonCalendar.controlsTitle}
        </h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <MonthControls month={month} onChange={onMonthChange} />
          <div>
            <p className="mb-2 text-sm opacity-70">{dict.ui.location}</p>
            <LocationPicker value={location} onChange={onLocationChange} />
          </div>
        </div>
      </section>

      {usedDefaults && data && (
        <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs">
          {dict.moonCalendar.showingDefaults}
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => location && run(month, location, selectedDate ?? undefined)}
            className="mt-2 rounded-lg border border-black/10 px-3 py-1.5 dark:border-white/20"
          >
            {dict.ui.retry}
          </button>
        </div>
      )}

      {loading && !data && (
        <div role="status" className="grid gap-3 md:grid-cols-7">
          <span className="sr-only">{dict.ui.loading}</span>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-black/10 motion-safe:animate-pulse dark:border-white/10" />
          ))}
        </div>
      )}

      {data && (
        <div data-testid="moon-calendar-result" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase text-accent">{dict.moonCalendar.monthLabel}</p>
                <h2 className="text-xl font-semibold">
                  {new Date(data.year, data.month - 1, 1).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
              </div>
              <p className="text-xs opacity-70">{data.location.name}</p>
            </div>
            <CalendarGrid
              days={data.days}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              locale={locale}
              dict={dict}
            />
            <MobileDayList
              days={data.days}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              locale={locale}
              dict={dict}
            />
          </section>

          <SelectedDayPanel day={selectedDay} locale={locale} dict={dict} />
        </div>
      )}
    </div>
  );
}

function MonthControls({
  month,
  onChange,
}: {
  month: { year: number; month: number };
  onChange: (month: { year: number; month: number }) => void;
}) {
  const { dict, locale } = useLocale();
  const display = new Date(month.year, month.month - 1, 1).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <div>
      <p className="mb-2 text-sm opacity-70">{dict.moonCalendar.monthLabel}</p>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          aria-label={dict.moonCalendar.previousMonth}
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
            min="1200-01"
            max="2399-12"
            onChange={(e) => {
              if (!e.target.value) return;
              const [year, nextMonth] = e.target.value.split("-").map(Number);
              onChange({ year, month: nextMonth });
            }}
            aria-label={dict.moonCalendar.pickMonth}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <button
          type="button"
          aria-label={dict.moonCalendar.nextMonth}
          onClick={() => onChange(shiftMonth(month.year, month.month, 1))}
          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          {">"}
        </button>
      </div>
    </div>
  );
}

function CalendarGrid({
  days,
  selectedDate,
  onSelect,
  locale,
  dict,
}: {
  days: MonthPanchangaDay[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
  locale: string;
  dict: ReturnType<typeof getDictionary>;
}) {
  const firstDate = new Date(`${days[0].date}T12:00:00`);
  const leadingBlanks = firstDate.getDay();
  const weekdayFormatter = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", { weekday: "short" });
  const weekdayHeaders = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(2026, 1, 1 + i)));
  return (
    <div data-testid="moon-calendar-grid" className="hidden md:flex md:flex-col md:gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] uppercase opacity-60">
        {weekdayHeaders.map((h, i) => (
          <span key={i}>{h}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}
        {days.map((day) => (
          <DayCell key={day.date} day={day} selected={day.date === selectedDate} onSelect={onSelect} dict={dict} />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  day,
  selected,
  onSelect,
  dict,
}: {
  day: MonthPanchangaDay;
  selected: boolean;
  onSelect: (date: string) => void;
  dict: ReturnType<typeof getDictionary>;
}) {
  const tone = phaseTone(day.moon_phase, day.is_poya_day);
  const title = `${day.date} ${dict.moonCalendar.phaseLabels[day.moon_phase]}`;
  return (
    <button
      type="button"
      data-testid={day.is_poya_day ? "moon-calendar-poya" : "moon-calendar-day"}
      title={title}
      aria-label={title}
      aria-current={selected ? "date" : undefined}
      onClick={() => onSelect(day.date)}
      className={`flex min-h-28 min-w-0 flex-col rounded-lg border p-2 text-left transition hover:border-accent/70 ${tone} ${
        selected ? "ring-2 ring-accent" : ""
      }`}
    >
      <span className="text-base font-semibold tabular-nums">{Number(day.date.slice(8))}</span>
      <span className="mt-1 text-xs font-medium leading-snug">{dict.moonCalendar.phaseLabels[day.moon_phase]}</span>
      <span className="mt-1 truncate text-[11px] opacity-70">{translateEnum(dict, "tithis", day.tithi[0].key)}</span>
      {day.is_poya_day && (
        <span className="mt-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          {dict.moonCalendar.poyaShort}
        </span>
      )}
    </button>
  );
}

function MobileDayList({
  days,
  selectedDate,
  onSelect,
  locale,
  dict,
}: {
  days: MonthPanchangaDay[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
  locale: string;
  dict: ReturnType<typeof getDictionary>;
}) {
  return (
    <div data-testid="moon-calendar-mobile-list" className="flex flex-col gap-2 md:hidden">
      {days.map((day) => (
        <button
          key={day.date}
          type="button"
          data-testid={day.is_poya_day ? "moon-calendar-poya" : "moon-calendar-day"}
          aria-current={day.date === selectedDate ? "date" : undefined}
          onClick={() => onSelect(day.date)}
          className={`rounded-lg border p-3 text-left ${phaseTone(day.moon_phase, day.is_poya_day)} ${
            day.date === selectedDate ? "ring-2 ring-accent" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{formatDate(day.date, locale)}</p>
              <p className="mt-1 text-sm opacity-75">
                {dict.moonCalendar.phaseLabels[day.moon_phase]} · {translateEnum(dict, "tithis", day.tithi[0].key)}
              </p>
            </div>
            {day.is_poya_day && (
              <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {dict.moonCalendar.poyaShort}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function SelectedDayPanel({
  day,
  locale,
  dict,
}: {
  day: MonthPanchangaDay | null;
  locale: string;
  dict: ReturnType<typeof getDictionary>;
}) {
  if (!day) return null;
  return (
    <aside
      data-testid="moon-calendar-selected-day"
      className="rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.04] lg:sticky lg:top-4 lg:self-start"
    >
      <p className="text-xs font-semibold uppercase text-accent">{dict.moonCalendar.selectedDay}</p>
      <h2 className="mt-1 text-lg font-semibold">{formatDate(day.date, locale)}</h2>
      {day.is_poya_day && day.poya && (
        <div className="mt-3">
          <PoyaDetailCard
            locale={locale}
            dict={dict}
            date={day.date}
            titleMonthKey={day.poya.month_key}
            isPoyaDay
            todayLabel={dict.panchanga.poyaTodayLabel}
            moonrise={day.moonrise}
            moonset={day.moonset}
            moonPhase={dict.moonCalendar.phaseLabels[day.moon_phase]}
            tithi={day.tithi}
            href={`/${locale}/daily-guide?date=${day.date}`}
            actionLabel={dict.moonCalendar.openDailyGuide}
            testId="moon-calendar-poya-detail"
          />
        </div>
      )}
      <dl className="mt-4 grid gap-3 text-sm">
        <Fact label={dict.moonCalendar.moonPhase} value={dict.moonCalendar.phaseLabels[day.moon_phase]} />
        <Fact label={dict.panchanga.sinhalaMonth} value={sinhalaMonthName(dict, day.sinhala_month.key)} />
        <Fact label={dict.ui.weekday} value={translateEnum(dict, "weekdays", day.weekday)} />
        <Fact label={dict.panchanga.moonrise} value={formatTime(day.moonrise, locale, dict.panchanga.notVisible)} />
        <Fact label={dict.panchanga.moonset} value={formatTime(day.moonset, locale, dict.panchanga.notVisible)} />
      </dl>
      <div className="mt-4 rounded-lg border border-black/10 p-3 dark:border-white/10">
        <p className="text-xs font-semibold uppercase opacity-60">{dict.panchanga.tithi}</p>
        <div className="mt-2 flex flex-col gap-2">
          {day.tithi.map((tithi) => (
            <p key={`${tithi.key}-${tithi.ends_at}`} className="text-sm">
              <span className="font-medium">{translateEnum(dict, "tithis", tithi.key)}</span>{" "}
              <span className="opacity-70">
                {locale === "si"
                  ? `${formatTime(tithi.ends_at, locale, "")} ${dict.panchanga.until}`
                  : `${dict.panchanga.until} ${formatTime(tithi.ends_at, locale, "")}`}
              </span>
            </p>
          ))}
        </div>
      </div>
      {!day.is_poya_day && (
        <Link
          href={`/${locale}/daily-guide?date=${day.date}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-black/10 px-3 py-2 text-sm font-semibold hover:border-accent hover:text-accent dark:border-white/20"
        >
          {dict.moonCalendar.openDailyGuide}
        </Link>
      )}
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

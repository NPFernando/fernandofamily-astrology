"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { nakshatraName, translateEnum } from "@/lib/i18n";
import { ApiError, fetchPanchanga, type DailyPanchanga } from "@/lib/api-client";
import { LocationPicker, DEFAULT_LOCATION, mostRecentLocation, type LocationValue } from "@/components/pancha-pakshi/LocationPicker";
import { DateNav } from "@/components/pancha-pakshi/DateNav";
import { SunIcon } from "@/components/icons/sun";

function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PanchangaClient() {
  const { dict, locale } = useLocale();
  const [date, setDate] = useState<string>(() => todayIso());
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [data, setData] = useState<DailyPanchanga | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedDefaults, setUsedDefaults] = useState(false);

  const run = useCallback(async (forDate: string, loc: LocationValue) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPanchanga({
        date: forDate,
        location_name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        iana_tz: loc.iana_tz,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
    } finally {
      setLoading(false);
    }
  }, [dict.ui.error]);

  useEffect(() => {
    // Zero-click first result: today at the most recent (or default Colombo)
    // location, same convention as the Pancha Pakshi calculator.
    const loc = mostRecentLocation() ?? DEFAULT_LOCATION;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time mount
       hydration from localStorage, same pattern as PanchaPakshiClient. */
    setLocation(loc);
    setUsedDefaults(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    void run(todayIso(), loc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDateChange = useCallback(
    (next: string) => {
      setDate(next);
      if (location) void run(next, location);
    },
    [location, run],
  );

  const onLocationChange = useCallback(
    (loc: LocationValue) => {
      setLocation(loc);
      setUsedDefaults(false);
      void run(date, loc);
    },
    [date, run],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="print:block">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <SunIcon className="text-3xl text-accent print:hidden" />
          {dict.panchanga.title}
        </h1>
      </header>

      <section
        aria-label={dict.ui.dailyDetails}
        data-testid="panchanga-controls"
        className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04] print:hidden"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">{dict.ui.dailyDetails}</h2>
        <div className="mt-3 flex flex-col gap-4">
          <DateNav date={date} onChange={onDateChange} />
          <div>
            <p className="mb-2 text-sm opacity-70">{dict.ui.location}</p>
            <LocationPicker value={location} onChange={onLocationChange} />
          </div>
        </div>
      </section>

      {usedDefaults && data && (
        <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs print:hidden">
          {dict.panchanga.showingDefaults}
        </p>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm print:hidden">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => location && run(date, location)}
            className="mt-2 rounded-lg border border-black/10 px-3 py-1.5 dark:border-white/20"
          >
            {dict.ui.retry}
          </button>
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
        <div data-testid="panchanga-result" className="flex flex-col gap-6">
          <p className="text-sm opacity-80">
            {new Date(`${data.date}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · {data.location.name} · {translateEnum(dict, "paksha", data.paksha)}
          </p>

          <section
            aria-label={dict.panchanga.title}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2"
          >
            <ElementCard title={dict.panchanga.tithi} testId="panchanga-tithi">
              {data.tithi.map((t) => (
                <SpanLine
                  key={`${t.key}-${t.ends_at}`}
                  name={translateEnum(dict, "tithis", t.key)}
                  endsAt={t.ends_at}
                  date={data.date}
                  locale={locale}
                  untilLabel={dict.panchanga.until}
                  nextDayLabel={dict.panchanga.nextDay}
                />
              ))}
            </ElementCard>

            <ElementCard title={dict.panchanga.nakshatra} testId="panchanga-nakshatra">
              {data.nakshatra.map((n) => (
                <SpanLine
                  key={`${n.key}-${n.ends_at}`}
                  name={`${nakshatraName(n.index, locale)} · ${dict.panchanga.pada} ${n.pada}`}
                  endsAt={n.ends_at}
                  date={data.date}
                  locale={locale}
                  untilLabel={dict.panchanga.until}
                  nextDayLabel={dict.panchanga.nextDay}
                />
              ))}
            </ElementCard>

            <ElementCard title={dict.panchanga.yoga} testId="panchanga-yoga">
              {data.yoga.map((y) => (
                <SpanLine
                  key={`${y.key}-${y.ends_at}`}
                  name={translateEnum(dict, "yogas", y.key)}
                  endsAt={y.ends_at}
                  date={data.date}
                  locale={locale}
                  untilLabel={dict.panchanga.until}
                  nextDayLabel={dict.panchanga.nextDay}
                />
              ))}
            </ElementCard>

            <ElementCard title={dict.panchanga.karana} testId="panchanga-karana">
              {data.karana.map((k) => (
                <SpanLine
                  key={`${k.index_60}-${k.ends_at}`}
                  name={translateEnum(dict, "karanas", k.key)}
                  endsAt={k.ends_at}
                  date={data.date}
                  locale={locale}
                  untilLabel={dict.panchanga.until}
                  nextDayLabel={dict.panchanga.nextDay}
                />
              ))}
            </ElementCard>

            <ElementCard title={dict.panchanga.lunarMonth} testId="panchanga-month">
              <p className="text-lg font-semibold">
                {translateEnum(dict, "lunarMonths", data.lunar_month.key)}
                {data.lunar_month.is_leap && (
                  <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs">
                    {dict.panchanga.leapMonth}
                  </span>
                )}
              </p>
            </ElementCard>

            <ElementCard title={dict.ui.weekday} testId="panchanga-weekday">
              <p className="text-lg font-semibold">{translateEnum(dict, "weekdays", data.weekday)}</p>
            </ElementCard>
          </section>

          <section
            aria-label={dict.panchanga.kalamsTitle}
            data-testid="panchanga-kalams"
            className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4"
          >
            <h2 className="text-sm font-semibold uppercase">{dict.panchanga.kalamsTitle}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["rahu", dict.panchanga.rahuKala],
                  ["yamaganda", dict.panchanga.yamaganda],
                  ["gulika", dict.panchanga.gulika],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="rounded-lg bg-white/40 p-3 text-sm dark:bg-black/20">
                  <p className="font-medium">{label}</p>
                  <p className="tabular-nums opacity-80">
                    {formatTime(data.kalams[key].starts_at, locale)} – {formatTime(data.kalams[key].ends_at, locale)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs opacity-70">{dict.panchanga.kalamsNote}</p>
          </section>

          <section
            aria-label={dict.panchanga.sunMoonTitle}
            className="grid grid-cols-2 gap-3 rounded-xl border border-black/10 p-4 text-sm dark:border-white/10 sm:grid-cols-4"
          >
            <TimeFact label={dict.ui.sunrise} value={formatTime(data.sunrise, locale)} />
            <TimeFact label={dict.ui.sunset} value={formatTime(data.sunset, locale)} />
            <TimeFact
              label={dict.panchanga.moonrise}
              value={data.moonrise ? formatTime(data.moonrise, locale) : dict.panchanga.notVisible}
            />
            <TimeFact
              label={dict.panchanga.moonset}
              value={data.moonset ? formatTime(data.moonset, locale) : dict.panchanga.notVisible}
            />
          </section>
        </div>
      )}

    </div>
  );
}

function ElementCard({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="print-avoid-break rounded-xl border border-black/10 p-4 dark:border-white/10"
    >
      <h2 className="text-xs font-semibold uppercase opacity-60">{title}</h2>
      <div className="mt-1 flex flex-col gap-1">{children}</div>
    </div>
  );
}

function SpanLine({
  name,
  endsAt,
  date,
  locale,
  untilLabel,
  nextDayLabel,
}: {
  name: string;
  endsAt: string;
  date: string;
  locale: string;
  untilLabel: string;
  nextDayLabel: string;
}) {
  const endsNextDay = !endsAt.startsWith(date);
  // Sinhala postposition: "15:13 දක්වා" (time first), English preposition:
  // "until 15:13" — word order differs by language, not just the label.
  const timeText = formatTime(endsAt, locale);
  const phrase = locale === "si" ? `${timeText} ${untilLabel}` : `${untilLabel} ${timeText}`;
  return (
    <p className="text-sm">
      <span className="font-semibold">{name}</span>{" "}
      <span className="opacity-70">
        {phrase}
        {endsNextDay && <> ({nextDayLabel})</>}
      </span>
    </p>
  );
}

function TimeFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase opacity-60">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

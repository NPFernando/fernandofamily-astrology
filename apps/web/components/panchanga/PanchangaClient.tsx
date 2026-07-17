"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { getDictionary, nakshatraName, translateEnum } from "@/lib/i18n";
import { ApiError, fetchPanchanga, fetchEclipseForecast, type DailyPanchanga, type EclipseForecast } from "@/lib/api-client";
import { LocationPicker, DEFAULT_LOCATION, mostRecentLocation, type LocationValue } from "@/components/pancha-pakshi/LocationPicker";
import { DateNav } from "@/components/pancha-pakshi/DateNav";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { SunIcon } from "@/components/icons/sun";
import { FullMoonIcon } from "@/components/icons/moon";
import { loadAccountPreferences } from "@/lib/account-preferences";
import { SkyTodayPanel } from "@/components/panchanga/SkyTodayPanel";
import { DailyTimingTimeline } from "@/components/panchanga/DailyTimingTimeline";
import { EFFECT_COLORS } from "@fernandofamily/design-system";

// Sinhala Poya-cycle month names (bak, vesak, ... madin) live under
// enums.sinhalaMonths; the API's "adhi-" prefix (leap month) is not itself a
// translated enum value — split it off and prepend the localized "Adhi" word
// so translateEnum's lookup table only needs the 12 base names.
function sinhalaMonthName(dict: ReturnType<typeof getDictionary>, key: string): string {
  const isAdhi = key.startsWith("adhi-");
  const baseKey = isAdhi ? key.slice(5) : key;
  const baseName = translateEnum(dict, "sinhalaMonths", baseKey);
  return isAdhi ? `${dict.panchanga.adhiPrefix} ${baseName}` : baseName;
}

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

// Eclipse contact times can fall months away from the requested date (unlike
// every other panchanga element, which is always same-day) — always show the
// date alongside the time.
function formatDateTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === "si" ? "si-LK" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PanchangaClient() {
  const { dict, locale } = useLocale();
  const [date, setDate] = useState<string>(() => todayIso());
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [data, setData] = useState<DailyPanchanga | null>(null);
  const [eclipses, setEclipses] = useState<EclipseForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedDefaults, setUsedDefaults] = useState(false);

  const run = useCallback(async (forDate: string, loc: LocationValue) => {
    setLoading(true);
    setError(null);
    try {
      const [result, eclipseResult] = await Promise.all([
        fetchPanchanga({
          date: forDate,
          location_name: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          iana_tz: loc.iana_tz,
        }),
        fetchEclipseForecast({
          from_date: forDate,
          location_name: loc.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          iana_tz: loc.iana_tz,
        }),
      ]);
      setData(result);
      setEclipses(eclipseResult);
    } catch (e) {
      setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
    } finally {
      setLoading(false);
    }
  }, [dict.ui.error]);

  useEffect(() => {
    // Zero-click first result: today at the account default, most recent, or
    // default Colombo location, same convention as the Pancha Pakshi
    // calculator.
    let cancelled = false;
    (async () => {
      const account = await loadAccountPreferences();
      if (cancelled) return;
      const loc = account.preferences?.default_location ?? mostRecentLocation() ?? DEFAULT_LOCATION;
      // "Today" must be resolved in the LOCATION's timezone, not the
      // browser's — otherwise a device whose system clock is in a different
      // zone than the (possibly default Colombo) location can load the
      // wrong calendar day's Panchanga near midnight, labeled as "today".
      const forDate = nowAsTargetDateTime(loc.iana_tz).date;
      setLocation(loc);
      setDate(forDate);
      setUsedDefaults(true);
      void run(forDate, loc);
    })();
    return () => {
      cancelled = true;
    };
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

          {data.is_poya_day && data.poya && (
            <div
              data-testid="panchanga-poya-badge"
              className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold"
            >
              <FullMoonIcon className="shrink-0 text-lg text-amber-600 dark:text-amber-400" />
              {dict.panchanga.poyaTodayLabel} · {sinhalaMonthName(dict, data.poya.month_key)}{" "}
              {dict.panchanga.poyaFullMoonSuffix}
            </div>
          )}

          <p className="text-xs opacity-70" data-testid="panchanga-next-poya">
            {dict.panchanga.nextPoyaLabel}:{" "}
            {sinhalaMonthName(dict, data.next_poya.month_key)}{" "}
            {new Date(`${data.next_poya.date}T12:00:00`).toLocaleDateString(
              locale === "si" ? "si-LK" : "en-US",
              { month: "long", day: "numeric" },
            )}
          </p>

          <SkyTodayPanel panchanga={data} testId="panchanga-sky-today" />

          <DailyTimingTimeline panchanga={data} compact testId="panchanga-timing-timeline" />

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
              {/* Sinhala Poya-cycle month leads (the reading a Sri Lankan
                  visitor expects — "Esala", not "Jyeshtha"); the Sanskrit
                  amanta name that the pinned engine actually computes from
                  stays visible as a secondary line, not hidden. "Adhi" is
                  already baked into the primary name by sinhalaMonthName, so
                  the leap badge lives on the secondary line instead, where
                  the amanta name alone wouldn't otherwise show it. */}
              <p className="text-lg font-semibold" data-testid="panchanga-sinhala-month">
                {sinhalaMonthName(dict, data.sinhala_month.key)}
                {locale === "en" && ` (${dict.panchanga.sinhalaMonth})`}
              </p>
              <p className="text-xs opacity-60">
                {translateEnum(dict, "lunarMonths", data.lunar_month.key)}
                {data.lunar_month.is_leap && (
                  <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px]">
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
            aria-label={dict.panchanga.amritKaalamTitle}
            data-testid="panchanga-favourable-muhurtas"
            className="rounded-xl border border-emerald-600/40 bg-emerald-500/10 p-4"
          >
            <h2 className="text-sm font-semibold uppercase">{dict.panchanga.amritKaalamTitle}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {data.amrit_kaalam.map((window, i) => (
                <p key={i} className="tabular-nums text-sm opacity-90">
                  {formatTime(window.starts_at, locale)} – {formatTime(window.ends_at, locale)}
                </p>
              ))}
            </div>
            <p className="mt-2 text-xs opacity-70">{dict.panchanga.amritKaalamNote}</p>

            <h2 className="mt-4 text-sm font-semibold uppercase">{dict.panchanga.abhijitMuhurtaTitle}</h2>
            <p className="mt-2 tabular-nums text-sm opacity-90">
              {formatTime(data.abhijit_muhurta.starts_at, locale)} – {formatTime(data.abhijit_muhurta.ends_at, locale)}
            </p>
            <p className="mt-2 text-xs opacity-70">{dict.panchanga.abhijitMuhurtaNote}</p>
          </section>

          <section
            aria-label={dict.panchanga.durmuhurtamTitle}
            data-testid="panchanga-durmuhurtam"
            className="rounded-xl border border-amber-600/40 bg-amber-500/10 p-4"
          >
            <h2 className="text-sm font-semibold uppercase">{dict.panchanga.durmuhurtamTitle}</h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {data.durmuhurtam.map((window, i) => (
                <p key={i} className="tabular-nums text-sm opacity-90">
                  {formatTime(window.starts_at, locale)} – {formatTime(window.ends_at, locale)}
                </p>
              ))}
            </div>
            <p className="mt-2 text-xs opacity-70">{dict.panchanga.durmuhurtamNote}</p>
          </section>

          <details
            className="rounded-xl border border-black/10 bg-white/30 p-3 dark:border-white/10 dark:bg-white/[.03]"
            data-testid="panchanga-choghadiya"
          >
            <summary className="cursor-pointer text-sm font-semibold uppercase text-accent">
              {dict.panchanga.choghadiyaTitle}
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.choghadiya.map((span, i) => (
                <div key={i} className="rounded-lg bg-white/40 p-2 text-xs dark:bg-black/20">
                  <p
                    className="font-medium"
                    style={{ color: span.is_auspicious ? EFFECT_COLORS.good : EFFECT_COLORS.bad }}
                  >
                    {translateEnum(dict, "choghadiya", span.key)}
                  </p>
                  <p className="tabular-nums opacity-80">
                    {formatTime(span.starts_at, locale)} – {formatTime(span.ends_at, locale)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs opacity-70">{dict.panchanga.choghadiyaNote}</p>
          </details>

          <details
            className="rounded-xl border border-black/10 bg-white/30 p-3 dark:border-white/10 dark:bg-white/[.03]"
            data-testid="panchanga-hora"
          >
            <summary className="cursor-pointer text-sm font-semibold uppercase text-accent">
              {dict.panchanga.horaTitle}
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.hora.map((span, i) => (
                <div key={i} className="rounded-lg bg-white/40 p-2 text-xs dark:bg-black/20">
                  <p
                    className="font-medium"
                    style={{ color: span.is_auspicious ? EFFECT_COLORS.good : EFFECT_COLORS.bad }}
                  >
                    {translateEnum(dict, "horaPlanets", span.key)}
                  </p>
                  <p className="tabular-nums opacity-80">
                    {formatTime(span.starts_at, locale)} – {formatTime(span.ends_at, locale)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs opacity-70">{dict.panchanga.horaNote}</p>
          </details>

          {eclipses && (
            <details
              className="rounded-xl border border-black/10 bg-white/30 p-3 dark:border-white/10 dark:bg-white/[.03]"
              data-testid="panchanga-eclipses"
            >
              <summary className="cursor-pointer text-sm font-semibold uppercase text-accent">
                {dict.panchanga.eclipseTitle}
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <EclipseCard
                  dict={dict}
                  locale={locale}
                  title={dict.panchanga.nextSolarEclipse}
                  type={eclipses.next_solar.type}
                  isVisible={eclipses.next_solar.is_visible}
                  maxAt={eclipses.next_solar.max_at}
                  rows={[
                    [dict.panchanga.eclipseFirstContact, eclipses.next_solar.first_contact_at],
                    [dict.panchanga.eclipseFourthContact, eclipses.next_solar.fourth_contact_at],
                  ]}
                  magnitudeLabel={dict.panchanga.eclipseMagnitude}
                  magnitudeValue={eclipses.next_solar.magnitude}
                  extraLabel={dict.panchanga.eclipseObscuration}
                  extraValue={eclipses.next_solar.obscuration}
                  sutakStart={eclipses.next_solar.sutak_starts_at}
                  sutakEnd={eclipses.next_solar.sutak_ends_at}
                />
                <EclipseCard
                  dict={dict}
                  locale={locale}
                  title={dict.panchanga.nextLunarEclipse}
                  type={eclipses.next_lunar.type}
                  isVisible={eclipses.next_lunar.is_visible}
                  maxAt={eclipses.next_lunar.max_at}
                  rows={[
                    [dict.panchanga.eclipseBegins, eclipses.next_lunar.begins_at],
                    [dict.panchanga.eclipseTotalityStarts, eclipses.next_lunar.totality_starts_at],
                    [dict.panchanga.eclipseTotalityEnds, eclipses.next_lunar.totality_ends_at],
                    [dict.panchanga.eclipseEnds, eclipses.next_lunar.ends_at],
                  ]}
                  magnitudeLabel={dict.panchanga.eclipseMagnitude}
                  magnitudeValue={eclipses.next_lunar.umbral_magnitude}
                  sutakStart={eclipses.next_lunar.sutak_starts_at}
                  sutakEnd={eclipses.next_lunar.sutak_ends_at}
                />
              </div>
              <p className="mt-2 text-xs opacity-70">{dict.panchanga.eclipseNote}</p>
              <p className="mt-1 text-xs opacity-70">{dict.panchanga.sutakKaalTitle}: {dict.panchanga.sutakKaalNote}</p>
            </details>
          )}

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

function EclipseCard({
  dict,
  locale,
  title,
  type,
  isVisible,
  maxAt,
  rows,
  magnitudeLabel,
  magnitudeValue,
  extraLabel,
  extraValue,
  sutakStart,
  sutakEnd,
}: {
  dict: ReturnType<typeof getDictionary>;
  locale: string;
  title: string;
  type: string;
  isVisible: boolean;
  maxAt: string;
  rows: [string, string | null][];
  magnitudeLabel: string;
  magnitudeValue: number;
  extraLabel?: string;
  extraValue?: number;
  sutakStart: string | null;
  sutakEnd: string | null;
}) {
  return (
    <div className="rounded-lg bg-white/40 p-3 text-sm dark:bg-black/20">
      <p className="font-semibold">{title}</p>
      <p className="text-xs opacity-70">{translateEnum(dict, "eclipseTypes", type)}</p>
      {!isVisible && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{dict.panchanga.eclipseNotVisible}</p>
      )}
      <p className="mt-1 tabular-nums text-xs opacity-90">
        {dict.panchanga.eclipseMaxAt}: {formatDateTime(maxAt, locale)}
      </p>
      {rows.map(
        ([label, value]) =>
          value && (
            <p key={label} className="tabular-nums text-xs opacity-80">
              {label}: {formatDateTime(value, locale)}
            </p>
          ),
      )}
      <p className="tabular-nums text-xs opacity-80">
        {magnitudeLabel}: {magnitudeValue.toFixed(3)}
      </p>
      {extraLabel && extraValue !== undefined && (
        <p className="tabular-nums text-xs opacity-80">
          {extraLabel}: {extraValue.toFixed(3)}
        </p>
      )}
      {sutakStart && sutakEnd && (
        <p className="mt-1 tabular-nums text-xs opacity-70">
          {dict.panchanga.sutakKaalTitle}: {formatDateTime(sutakStart, locale)} – {formatDateTime(sutakEnd, locale)}
        </p>
      )}
    </div>
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

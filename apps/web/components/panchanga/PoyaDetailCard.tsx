"use client";

import Link from "next/link";
import { getDictionary, translateEnum } from "@/lib/i18n";
import { FullMoonIcon } from "@/components/icons/moon";

type TithiSummary = {
  key: string;
  ends_at: string;
};

type PoyaDetailCardProps = {
  locale: string;
  dict: ReturnType<typeof getDictionary>;
  date: string;
  titleMonthKey: string;
  isPoyaDay: boolean;
  todayLabel: string;
  upcomingLabel?: string;
  moonrise?: string | null;
  moonset?: string | null;
  moonPhase?: string;
  tithi?: TithiSummary[];
  href: string;
  actionLabel: string;
  testId: string;
};

function sinhalaMonthName(dict: ReturnType<typeof getDictionary>, key: string): string {
  const isAdhi = key.startsWith("adhi-");
  const baseKey = isAdhi ? key.slice(5) : key;
  const baseName = translateEnum(dict, "sinhalaMonths", baseKey);
  return isAdhi ? `${dict.panchanga.adhiPrefix} ${baseName}` : baseName;
}

// An adhi- leap month observes the same festival as its base month, so the
// significance lookup always strips the prefix.
function poyaSignificance(dict: ReturnType<typeof getDictionary>, key: string): string {
  const baseKey = key.startsWith("adhi-") ? key.slice(5) : key;
  return translateEnum(dict, "poyaSignificance", baseKey);
}

function formatDate(date: string, locale: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === "si" ? "si-LK" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string | null | undefined, locale: string, fallback: string) {
  if (!iso) return fallback;
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(date: string) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${date}T12:00:00`);
  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.max(0, Math.round((targetUtc - todayUtc) / 86_400_000));
}

function countdownText(dict: ReturnType<typeof getDictionary>, locale: string, date: string) {
  const count = daysUntil(date);
  if (count === 0) return dict.dailyGuide.poyaTodayCountdown;
  const template = count === 1 ? dict.dailyGuide.poyaTomorrowCountdown : dict.dailyGuide.poyaDaysCountdown;
  return template.replace("{count}", new Intl.NumberFormat(locale === "si" ? "si-LK" : "en-US").format(count));
}

export function PoyaDetailCard({
  locale,
  dict,
  date,
  titleMonthKey,
  isPoyaDay,
  todayLabel,
  upcomingLabel,
  moonrise,
  moonset,
  moonPhase,
  tithi,
  href,
  actionLabel,
  testId,
}: PoyaDetailCardProps) {
  const monthName = sinhalaMonthName(dict, titleMonthKey);
  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-amber-500/45 bg-amber-500/10 p-4 text-sm dark:bg-amber-500/[.08]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">
            <FullMoonIcon className="text-lg" />
            {isPoyaDay ? todayLabel : upcomingLabel ?? dict.panchanga.nextPoyaLabel}
          </p>
          <h2 className="mt-1 text-lg font-semibold leading-tight">
            {monthName} {dict.panchanga.poyaFullMoonSuffix}
          </h2>
          <p className="mt-1 text-xs opacity-75">{formatDate(date, locale)}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80" data-testid="poya-significance">
            {poyaSignificance(dict, titleMonthKey)}
          </p>
          {!isPoyaDay && <p className="mt-2 text-sm font-medium">{countdownText(dict, locale, date)}</p>}
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-amber-600/40 px-3 py-2 text-xs font-semibold text-amber-800 hover:border-amber-700 hover:bg-amber-500/15 dark:text-amber-200"
        >
          {actionLabel}
        </Link>
      </div>

      {(moonPhase || moonrise !== undefined || moonset !== undefined || (tithi && tithi.length > 0)) && (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {moonPhase && <Fact label={dict.moonCalendar.moonPhase} value={moonPhase} />}
          {moonrise !== undefined && (
            <Fact label={dict.panchanga.moonrise} value={formatTime(moonrise, locale, dict.panchanga.notVisible)} />
          )}
          {moonset !== undefined && (
            <Fact label={dict.panchanga.moonset} value={formatTime(moonset, locale, dict.panchanga.notVisible)} />
          )}
          {tithi?.slice(0, 2).map((item) => (
            <Fact
              key={`${item.key}-${item.ends_at}`}
              label={dict.panchanga.tithi}
              value={`${translateEnum(dict, "tithis", item.key)} · ${formatTime(item.ends_at, locale, "")}`}
            />
          ))}
        </dl>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-amber-700/15 bg-white/35 px-3 py-2 dark:bg-black/10">
      <dt className="text-[11px] font-semibold uppercase opacity-70">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

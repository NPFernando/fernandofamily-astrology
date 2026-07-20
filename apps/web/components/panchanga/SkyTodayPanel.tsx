"use client";

import { nakshatraName, translateEnum } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";
import type { DailyPanchanga, GrahaPosition } from "@/lib/api-client";

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function untilText(iso: string, date: string, locale: string, untilLabel: string, nextDayLabel: string) {
  const timeText = formatTime(iso, locale);
  const phrase = locale === "si" ? `${timeText} ${untilLabel}` : `${untilLabel} ${timeText}`;
  return `${phrase}${iso.startsWith(date) ? "" : ` (${nextDayLabel})`}`;
}

function inSignDegree(position: GrahaPosition) {
  const raw = position.longitude_degrees % 30;
  let degrees = Math.floor(raw);
  let minutes = Math.round((raw - degrees) * 60);
  if (minutes === 60) {
    degrees += 1;
    minutes = 0;
  }
  return `${degrees}° ${String(minutes).padStart(2, "0")}'`;
}

export function SkyTodayPanel({
  panchanga,
  compact = false,
  testId = "sky-today-panel",
}: {
  panchanga: DailyPanchanga;
  compact?: boolean;
  testId?: string;
}) {
  const { dict, locale } = useLocale();
  const retrograde = panchanga.graha_positions.filter((p) => p.is_retrograde);

  return (
    <section
      data-testid={testId}
      aria-label={dict.panchanga.skyTodayTitle}
      className="rounded-xl border border-sky-600/30 bg-sky-500/10 p-4 dark:border-sky-400/25 dark:bg-sky-400/[.08]"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase text-accent">{dict.panchanga.skyTodayTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed opacity-70">{dict.panchanga.skyTodayNote}</p>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2 md:min-w-[20rem]">
          <SkyFact
            label={dict.panchanga.moonRashi}
            value={translateEnum(dict, "rashis", panchanga.moon_rashi.key)}
            detail={untilText(
              panchanga.moon_rashi.ends_at,
              panchanga.date,
              locale,
              dict.panchanga.until,
              dict.panchanga.nextDay,
            )}
          />
          <SkyFact
            label={dict.panchanga.ritu}
            value={translateEnum(dict, "ritus", panchanga.ritu.key)}
            detail={dict.panchanga.season}
          />
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-black/10 bg-background/70 p-3 text-sm dark:border-white/10 dark:bg-black/15">
        <p className="text-xs font-semibold uppercase opacity-70">{dict.panchanga.retrogradeSummary}</p>
        <p className="mt-1 font-medium">
          {retrograde.length > 0
            ? retrograde.map((p) => translateEnum(dict, "horaPlanets", p.key)).join(", ")
            : dict.panchanga.noRetrograde}
        </p>
      </div>

      {!compact && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {panchanga.graha_positions.map((position) => (
            <div
              key={position.key}
              className="min-w-0 rounded-lg border border-black/10 bg-background/70 p-3 text-xs dark:border-white/10 dark:bg-black/15"
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="break-words font-semibold">{translateEnum(dict, "horaPlanets", position.key)}</p>
                {position.is_retrograde && (
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                    {dict.panchanga.retrograde}
                  </span>
                )}
              </div>
              <p className="mt-1 break-words opacity-85">{translateEnum(dict, "rashis", position.rashi_key)}</p>
              <p className="mt-1 opacity-70">
                {nakshatraName(position.nakshatra_index, locale)} · {inSignDegree(position)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SkyFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-background/70 p-3 dark:border-white/10 dark:bg-black/15">
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
      <p className="mt-0.5 text-xs opacity-70">{detail}</p>
    </div>
  );
}

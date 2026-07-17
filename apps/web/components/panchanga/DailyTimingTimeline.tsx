"use client";

import { useMemo } from "react";
import { EFFECT_COLORS } from "@fernandofamily/design-system";
import { useLocale } from "@/lib/locale-context";
import { getDictionary, translateEnum } from "@/lib/i18n";
import type { DailyPanchanga, EffectId, KalamRange, ScheduleResponse } from "@/lib/api-client";

type Dictionary = ReturnType<typeof getDictionary>;

type TimelineTone = "avoid" | "personal";

type TimelineItem = {
  id: string;
  row: TimelineTone;
  label: string;
  startsAt: string;
  endsAt: string;
  effect?: EffectId;
};

type TimelineRow = {
  id: TimelineTone;
  label: string;
  items: TimelineItem[];
  empty?: string;
};

const ROW_STYLES: Record<TimelineTone, { border: string; bg: string; text: string }> = {
  avoid: {
    border: "border-amber-500/45",
    bg: "bg-amber-500/10",
    text: "text-amber-800 dark:text-amber-200",
  },
  personal: {
    border: "border-sky-500/45",
    bg: "bg-sky-500/10",
    text: "text-sky-800 dark:text-sky-200",
  },
};

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function percentBetween(value: number, start: number, end: number) {
  if (end <= start) return 0;
  return Math.max(0, Math.min(100, ((value - start) / (end - start)) * 100));
}

function itemRangeStyle(item: TimelineItem, dayStartMs: number, dayEndMs: number) {
  const start = new Date(item.startsAt).getTime();
  const end = new Date(item.endsAt).getTime();
  const left = percentBetween(start, dayStartMs, dayEndMs);
  const right = percentBetween(end, dayStartMs, dayEndMs);
  return {
    left: `${left}%`,
    width: `${Math.max(right - left, 1.2)}%`,
  };
}

function rangeItem(id: string, row: TimelineTone, label: string, range: KalamRange): TimelineItem {
  return { id, row, label, startsAt: range.starts_at, endsAt: range.ends_at };
}

function personalItems(schedule: ScheduleResponse | undefined, dict: Dictionary) {
  if (!schedule) return [];
  return schedule.major_periods
    .flatMap((major) => major.sub_periods)
    .filter((period) => period.effect === "good" || period.effect === "very_good")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .map((period) => ({
      id: period.id,
      row: "personal" as const,
      label: `${translateEnum(dict, "birds", period.sub_bird)} · ${translateEnum(dict, "activities", period.sub_activity)}`,
      startsAt: period.starts_at,
      endsAt: period.ends_at,
      effect: period.effect,
    }));
}

export function DailyTimingTimeline({
  panchanga,
  schedule,
  referenceAt,
  compact = false,
  testId = "daily-timing-timeline",
}: {
  panchanga: DailyPanchanga;
  schedule?: ScheduleResponse;
  referenceAt?: string;
  compact?: boolean;
  testId?: string;
}) {
  const { dict, locale } = useLocale();
  const timeline = dict.dailyGuide.timeline;

  const rows = useMemo<TimelineRow[]>(() => {
    const avoid: TimelineItem[] = [
      rangeItem("rahu", "avoid", dict.panchanga.rahuKala, panchanga.kalams.rahu),
      rangeItem("yamaganda", "avoid", dict.panchanga.yamaganda, panchanga.kalams.yamaganda),
      rangeItem("gulika", "avoid", dict.panchanga.gulika, panchanga.kalams.gulika),
    ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    return [
      { id: "avoid", label: timeline.avoidRow, items: avoid },
      {
        id: "personal",
        label: timeline.personalRow,
        items: personalItems(schedule, dict),
        empty: schedule ? timeline.noPersonalWindows : timeline.personalUnavailable,
      },
    ];
  }, [dict, panchanga, schedule, timeline]);

  const dayStartMs = new Date(panchanga.sunrise).getTime();
  const dayEndMs = new Date(panchanga.sunset).getTime();
  const referenceMs = new Date(referenceAt ?? new Date().toISOString()).getTime();
  const showNow = referenceMs >= dayStartMs && referenceMs <= dayEndMs;
  const nowLeft = percentBetween(referenceMs, dayStartMs, dayEndMs);

  const visibleRows = compact ? rows.filter((row) => row.id !== "personal") : rows;

  return (
    <section
      data-testid={testId}
      className={`rounded-xl border border-black/10 bg-white/35 p-4 dark:border-white/10 dark:bg-white/[.03] ${
        compact ? "print:hidden" : ""
      }`}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase text-accent">{timeline.title}</h2>
          <p className="mt-1 text-xs leading-relaxed opacity-70">{timeline.description}</p>
        </div>
        <p className="text-xs tabular-nums opacity-70">
          {formatTime(new Date(dayStartMs).toISOString(), locale)}-{formatTime(new Date(dayEndMs).toISOString(), locale)}
        </p>
      </div>

      <div className="mt-4 hidden md:block" data-testid={`${testId}-strip`}>
        <div className="relative flex h-5 items-center border-t border-black/10 text-[11px] opacity-70 dark:border-white/10">
          <span>{formatTime(new Date(dayStartMs).toISOString(), locale)}</span>
          <span className="ml-auto">{formatTime(new Date(dayEndMs).toISOString(), locale)}</span>
          {showNow && (
            <span
              className="absolute top-0 h-28 border-l-2 border-accent"
              style={{ left: `${nowLeft}%` }}
              aria-label={timeline.now}
              title={timeline.now}
            />
          )}
        </div>
        <div className="mt-2 grid gap-3">
          {visibleRows.map((row) => (
            <div key={row.id} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-3">
              <p className="text-xs font-semibold uppercase opacity-60">{row.label}</p>
              <div className="relative h-10 rounded-lg border border-black/10 bg-background dark:border-white/10">
                {row.items.length > 0 ? (
                  row.items.map((item) => (
                    <span
                      key={item.id}
                      title={`${item.label} ${formatTime(item.startsAt, locale)}-${formatTime(item.endsAt, locale)}`}
                      className={`absolute top-1 flex h-8 items-center overflow-hidden rounded-md border px-2 text-[11px] font-semibold leading-none ${ROW_STYLES[item.row].border} ${ROW_STYLES[item.row].bg} ${ROW_STYLES[item.row].text}`}
                      style={{
                        ...itemRangeStyle(item, dayStartMs, dayEndMs),
                        color: item.effect ? EFFECT_COLORS[item.effect] : undefined,
                      }}
                    >
                      <span className="truncate">{item.label}</span>
                    </span>
                  ))
                ) : (
                  <p className="flex h-full items-center px-3 text-xs opacity-60">{row.empty}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:hidden" data-testid={`${testId}-cards`}>
        {visibleRows.map((row) => (
          <div key={row.id} className="rounded-lg border border-black/10 bg-background p-3 dark:border-white/10">
            <h3 className="text-xs font-semibold uppercase opacity-60">{row.label}</h3>
            {row.items.length > 0 ? (
              <div className="mt-2 grid gap-2">
                {row.items.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-md border px-3 py-2 text-sm ${ROW_STYLES[item.row].border} ${ROW_STYLES[item.row].bg}`}
                  >
                    <p className="break-words font-semibold" style={{ color: item.effect ? EFFECT_COLORS[item.effect] : undefined }}>
                      {item.label}
                    </p>
                    <p className="mt-0.5 tabular-nums opacity-75">
                      {formatTime(item.startsAt, locale)}-{formatTime(item.endsAt, locale)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm opacity-70">{row.empty}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] opacity-70">
        <span>{timeline.legendAvoid}</span>
        {!compact && <span>{timeline.legendPersonal}</span>}
        {showNow && <span>{timeline.now}</span>}
      </div>
    </section>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { MajorPeriod, ScheduleResponse, SubPeriod } from "@/lib/api-client";
import { ACTIVITY_COLORS } from "./activityColors";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { BIRD_ICONS } from "@/components/icons/birds";
import { DayTimelineBar } from "./DayTimelineBar";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import type { ScheduleRequest } from "@/lib/api-client";
import { activityGuidance } from "@/lib/pancha-guidance";

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScheduleTimeline({
  schedule,
  skewMs = 0,
  weekRequest,
  onPickDay,
}: {
  schedule: ScheduleResponse;
  skewMs?: number;
  // When provided, a third "Week" view becomes available: a 7-day overview
  // of favourable windows starting from this request's target date.
  weekRequest?: ScheduleRequest;
  onPickDay?: (date: string) => void;
}) {
  const { dict, locale } = useLocale();
  const [view, setView] = useState<"timeline" | "table" | "week" | "month">("timeline");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(index: number) {
    // In table view every period renders expanded regardless of this set, so
    // header clicks there must not mutate it — they'd invisibly accumulate
    // expansions that surprise the user after switching back to timeline.
    if (view !== "timeline") return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const dayPeriods = schedule.major_periods.filter((p) => p.kind === "day");
  const nightPeriods = schedule.major_periods.filter((p) => p.kind === "night");

  // Tapping a segment in the overview bar expands that major period's card
  // and brings it into view — the bar is the map, the cards are the detail.
  const selectFromBar = useCallback((majorIndex: number) => {
    setExpanded((prev) => new Set(prev).add(majorIndex));
    requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .getElementById(`major-period-${majorIndex}`)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
  }, []);

  return (
    <div className="flex flex-col gap-4 print:gap-2">
      <DayTimelineBar schedule={schedule} onSelectMajor={selectFromBar} skewMs={skewMs} />

      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div role="tablist" aria-label={dict.ui.schedule} className="flex flex-wrap gap-2 text-sm">
          <ViewButton active={view === "timeline"} onClick={() => setView("timeline")}>
            {dict.ui.timelineView}
          </ViewButton>
          <ViewButton active={view === "table"} onClick={() => setView("table")}>
            {dict.ui.tableView}
          </ViewButton>
          {weekRequest && onPickDay && (
            <>
              <ViewButton active={view === "week"} onClick={() => setView("week")}>
                {dict.ui.weekView}
              </ViewButton>
              <ViewButton active={view === "month"} onClick={() => setView("month")}>
                {dict.ui.monthView}
              </ViewButton>
            </>
          )}
        </div>
      </div>

      {view === "week" && weekRequest && onPickDay ? (
        <WeekView request={weekRequest} onPickDay={onPickDay} />
      ) : view === "month" && weekRequest && onPickDay ? (
        <MonthView request={weekRequest} onPickDay={onPickDay} />
      ) : (
        <>
          <PeriodGroup
            title={dict.ui.daytime}
            periods={dayPeriods}
            view={view}
            expanded={expanded}
            onToggle={toggle}
            locale={locale}
          />
          <PeriodGroup
            title={dict.ui.nighttime}
            periods={nightPeriods}
            view={view}
            expanded={expanded}
            onToggle={toggle}
            locale={locale}
          />
        </>
      )}
    </div>
  );
}

// Module scope, not nested in ScheduleTimeline: a component defined inside
// another's body is a brand-new type every render, forcing React to unmount
// and remount it (and drop focus) on each parent re-render.
function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 ${
        active ? "border-accent bg-accent/10 font-semibold text-accent" : "border-black/10 opacity-70 dark:border-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function PeriodGroup({
  title,
  periods,
  view,
  expanded,
  onToggle,
  locale,
}: {
  title: string;
  periods: MajorPeriod[];
  view: "timeline" | "table" | "week" | "month";
  expanded: Set<number>;
  onToggle: (i: number) => void;
  locale: string;
}) {
  const { dict } = useLocale();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase opacity-60">{title}</h3>
      <div className="flex flex-col gap-2">
        {periods.map((period) => (
          <MajorPeriodCard
            key={period.index}
            period={period}
            view={view}
            // Table view is the full timetable: every period's rows visible
            // without per-card expanding (collapsed-by-default made the view
            // toggle look like it did nothing). Collapse only applies to the
            // timeline view.
            isExpanded={view === "table" || expanded.has(period.index)}
            onToggle={() => onToggle(period.index)}
            locale={locale}
          />
        ))}
      </div>
      <span className="sr-only">{dict.ui.majorPeriod}</span>
    </div>
  );
}

function MajorPeriodCard({
  period,
  view,
  isExpanded,
  onToggle,
  locale,
}: {
  period: MajorPeriod;
  view: "timeline" | "table" | "week" | "month";
  isExpanded: boolean;
  onToggle: () => void;
  locale: string;
}) {
  const { dict } = useLocale();
  const color = ACTIVITY_COLORS[period.main_activity];
  const isCurrent = period.sub_periods.some((s) => s.is_current);
  const BirdIcon = BIRD_ICONS[period.main_bird];
  const ActivityIcon = ACTIVITY_ICONS[period.main_activity];

  return (
    <div
      id={`major-period-${period.index}`}
      className={`overflow-hidden rounded-xl border ${
        isCurrent ? "border-accent" : "border-black/10 dark:border-white/10"
      }`}
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
            <BirdIcon className="shrink-0 text-lg opacity-90" />
            {translateEnum(dict, "birds", period.main_bird)} —{" "}
            <ActivityIcon className="shrink-0 text-lg" style={{ color }} />
            {translateEnum(dict, "activities", period.main_activity)}
          </span>
          <span className="text-xs opacity-70">
            {formatTime(period.starts_at, locale)} – {formatTime(period.ends_at, locale)}
          </span>
        </div>
        {isCurrent && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">
            {dict.ui.current}
          </span>
        )}
        {view !== "table" && (
          <span aria-hidden className="text-xs opacity-60">
            {isExpanded ? dict.ui.collapse : dict.ui.expand}
          </span>
        )}
      </button>

      {isExpanded &&
        (view === "table" ? (
          <SubPeriodTable subPeriods={period.sub_periods} locale={locale} />
        ) : (
          <SubPeriodTimeline subPeriods={period.sub_periods} locale={locale} />
        ))}
    </div>
  );
}

function SubPeriodTable({ subPeriods, locale }: { subPeriods: SubPeriod[]; locale: string }) {
  const { dict } = useLocale();
  return (
    <div className="overflow-x-auto border-t border-black/10 dark:border-white/10">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead className="opacity-60">
          <tr>
            <th className="px-3 py-2">{dict.ui.startsAt}</th>
            <th className="px-3 py-2">{dict.ui.endsAt}</th>
            <th className="px-3 py-2">{dict.ui.subBird}</th>
            <th className="px-3 py-2">{dict.ui.subActivity}</th>
            <th className="px-3 py-2">{dict.ui.relation}</th>
            <th className="px-3 py-2">{dict.ui.effect}</th>
            <th className="px-3 py-2">{dict.ui.rating}</th>
          </tr>
        </thead>
        <tbody>
          {subPeriods.map((sp) => (
            <tr key={sp.id} className={sp.is_current ? "bg-accent/10 font-medium" : ""}>
              <td className="px-3 py-2">{formatTime(sp.starts_at, locale)}</td>
              <td className="px-3 py-2">{formatTime(sp.ends_at, locale)}</td>
              <td className="px-3 py-2">{translateEnum(dict, "birds", sp.sub_bird)}</td>
              <td className="px-3 py-2">{translateEnum(dict, "activities", sp.sub_activity)}</td>
              <td className="px-3 py-2">{translateEnum(dict, "relations", sp.relation)}</td>
              <td className="px-3 py-2">{translateEnum(dict, "effects", sp.effect)}</td>
              <td className="px-3 py-2">{sp.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubPeriodTimeline({ subPeriods, locale }: { subPeriods: SubPeriod[]; locale: string }) {
  const { dict } = useLocale();
  return (
    <ul className="flex flex-col gap-1 border-t border-black/10 p-3 dark:border-white/10">
      {subPeriods.map((sp) => {
        const SubBirdIcon = BIRD_ICONS[sp.sub_bird];
        const SubActivityIcon = ACTIVITY_ICONS[sp.sub_activity];
        return (
          <li
            key={sp.id}
            className={`flex flex-col gap-1.5 rounded-lg px-3 py-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 ${
              sp.is_current ? "bg-accent/10 font-semibold" : "bg-black/[.02] dark:bg-white/[.04]"
            }`}
            style={{ borderLeft: `3px solid ${ACTIVITY_COLORS[sp.sub_activity]}` }}
          >
            <span className="shrink-0 tabular-nums">
              {formatTime(sp.starts_at, locale)} – {formatTime(sp.ends_at, locale)}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
              <SubBirdIcon className="shrink-0 text-base opacity-90" />
              {translateEnum(dict, "birds", sp.sub_bird)} ·{" "}
              <SubActivityIcon className="shrink-0 text-base" style={{ color: ACTIVITY_COLORS[sp.sub_activity] }} />
              {translateEnum(dict, "activities", sp.sub_activity)}
            </span>
            <span className="shrink-0 opacity-70">{translateEnum(dict, "effects", sp.effect)}</span>
            <span className="basis-full text-xs leading-relaxed opacity-65 sm:ml-[7.5rem]">
              {activityGuidance(dict, sp.sub_activity)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

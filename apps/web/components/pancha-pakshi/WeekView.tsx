"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import {
  fetchWindows,
  type ActivityId,
  type ScheduleRequest,
  type WindowEntry,
  type WindowsResponse,
} from "@/lib/api-client";
import { BIRD_ICONS } from "@/components/icons/birds";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { ACTIVITY_COLORS } from "./activityColors";
import { buildIcs, downloadIcs, type IcsEvent } from "@/lib/ics";

const ALL_ACTIVITIES: ActivityId[] = ["ruling", "eating", "walking", "sleeping", "dying"];
const DURATION_CHOICES = [0, 900, 1800, 3600] as const;

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 7-day overview of good/very_good windows via POST /windows. Absence of
// the endpoint (older API) or any failure degrades to a friendly notice —
// the day views remain fully usable without it.
export function WeekView({
  request,
  onPickDay,
}: {
  request: ScheduleRequest; // the last day request; target_date = week start
  onPickDay: (date: string) => void;
}) {
  const { dict, locale } = useLocale();
  const [data, setData] = useState<WindowsResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [attempt, setAttempt] = useState(0);
  // Ephemeral narrowing controls — deliberately not persisted anywhere.
  const [activeActivities, setActiveActivities] = useState<Set<ActivityId>>(
    () => new Set(ALL_ACTIVITIES),
  );
  const [minDuration, setMinDuration] = useState<number>(0);

  const narrowed = activeActivities.size < ALL_ACTIVITIES.length || minDuration > 0;

  useEffect(() => {
    let cancelled = false;
    // Resets to loading when the request identity or filters change; the
    // fetch below is the async work this effect exists to perform.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    fetchWindows({
      ...request,
      days: 7,
      min_effect: "good",
      // Only send the narrowing params when actually narrowed, keeping the
      // default request identical to the pre-filter behavior.
      ...(activeActivities.size < ALL_ACTIVITIES.length
        ? { activities: [...activeActivities] }
        : {}),
      ...(minDuration > 0 ? { min_duration_seconds: minDuration } : {}),
    })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [request, activeActivities, minDuration, attempt]);

  const durationLabels: Record<number, string> = useMemo(
    () => ({
      0: dict.ui.durationAny,
      900: dict.ui.duration15m,
      1800: dict.ui.duration30m,
      3600: dict.ui.duration1h,
    }),
    [dict],
  );

  function toggleActivity(a: ActivityId) {
    setActiveActivities((prev) => {
      const next = new Set(prev);
      if (next.has(a)) {
        next.delete(a);
        if (next.size === 0) return new Set(ALL_ACTIVITIES); // never empty — reset
      } else {
        next.add(a);
      }
      return next;
    });
  }

  function windowSummary(w: WindowEntry): string {
    return `${translateEnum(dict, "birds", w.sub_bird)} — ${translateEnum(dict, "activities", w.sub_activity)} · ${translateEnum(dict, "effects", w.effect)}`;
  }

  function toIcsEvent(w: WindowEntry): IcsEvent {
    return {
      uid: `${w.effective_date}-${w.id}`,
      start: new Date(w.starts_at),
      end: new Date(w.ends_at),
      summary: windowSummary(w),
      description: dict.ui.icsDescription,
    };
  }

  function downloadAll() {
    if (!data || data.windows.length === 0) return;
    downloadIcs("pancha-pakshi-windows.ics", buildIcs(data.windows.map(toIcsEvent)));
  }

  const filterControls = (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="week-filters">
      {ALL_ACTIVITIES.map((a) => {
        const ActivityIcon = ACTIVITY_ICONS[a];
        const active = activeActivities.has(a);
        return (
          <button
            key={a}
            type="button"
            data-testid={`week-filter-${a}`}
            aria-pressed={active}
            onClick={() => toggleActivity(a)}
            className={`flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              active
                ? "border-accent bg-accent/10 font-medium text-accent"
                : "border-black/10 opacity-50 dark:border-white/20"
            }`}
          >
            <ActivityIcon className="text-base" style={{ color: ACTIVITY_COLORS[a] }} />
            {translateEnum(dict, "activities", a)}
          </button>
        );
      })}
      <label className="ml-auto flex items-center gap-1.5">
        <span className="opacity-70">{dict.ui.minDuration}</span>
        <select
          value={minDuration}
          onChange={(e) => setMinDuration(Number(e.target.value))}
          className="rounded-lg border border-black/10 bg-transparent px-2 py-1 dark:border-white/20"
        >
          {DURATION_CHOICES.map((s) => (
            <option key={s} value={s}>
              {durationLabels[s]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        data-testid="week-download-ics"
        onClick={downloadAll}
        disabled={!data || data.windows.length === 0}
        className="rounded-lg border border-black/10 px-2.5 py-1 hover:border-accent/60 disabled:opacity-40 dark:border-white/20"
      >
        {dict.ui.downloadIcs}
      </button>
    </div>
  );

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {filterControls}
        <p className="py-4 text-sm opacity-70">{dict.ui.weekLoading}</p>
      </div>
    );
  }
  if (state === "unavailable" || !data) {
    return (
      <div className="flex flex-col gap-3">
        {filterControls}
        <div className="flex flex-col items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <p>{dict.ui.weekUnavailable}</p>
          <button
            type="button"
            data-testid="week-retry"
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded-full border border-amber-600/40 px-3 py-1 text-xs font-medium hover:bg-amber-500/10 dark:border-amber-300/40"
          >
            {dict.ui.retry}
          </button>
        </div>
      </div>
    );
  }

  const byDate = new Map<string, WindowEntry[]>();
  for (const w of data.windows) {
    const list = byDate.get(w.effective_date) ?? [];
    list.push(w);
    byDate.set(w.effective_date, list);
  }
  const days: string[] = [];
  {
    const start = new Date(`${data.from_date}T12:00:00`);
    const pad = (n: number) => String(n).padStart(2, "0");
    for (let i = 0; i < data.days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {filterControls}
      {narrowed && data.windows.length === 0 && (
        <p className="text-sm opacity-70">{dict.ui.noFilteredWindows}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 lg:gap-2">
        {days.map((date) => {
          const entries = byDate.get(date) ?? [];
          const heading = new Date(`${date}T12:00:00`).toLocaleDateString(
            locale === "si" ? "si-LK" : "en-US",
            { weekday: "short", month: "short", day: "numeric" },
          );
          return (
            <div
              key={date}
              data-testid="week-day"
              className="rounded-xl border border-black/10 p-2.5 dark:border-white/10"
            >
              <button
                type="button"
                onClick={() => onPickDay(date)}
                className="mb-1.5 w-full text-left text-sm font-semibold hover:text-accent"
              >
                {heading}
              </button>
              {entries.length === 0 ? (
                <p className="text-xs opacity-50">—</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {entries.map((w) => {
                    const BirdIcon = BIRD_ICONS[w.sub_bird];
                    const ActivityIcon = ACTIVITY_ICONS[w.sub_activity];
                    return (
                      <li key={`${w.effective_date}-${w.id}`} className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid="week-window-chip"
                          onClick={() => onPickDay(date)}
                          title={windowSummary(w)}
                          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border border-black/5 px-2 py-1.5 text-left text-xs hover:border-accent/50 dark:border-white/10"
                          style={{ borderLeftWidth: 3, borderLeftColor: ACTIVITY_COLORS[w.sub_activity] }}
                        >
                          <span className="shrink-0 tabular-nums">
                            {formatTime(w.starts_at, locale)}
                          </span>
                          <BirdIcon className="shrink-0 text-base opacity-90" />
                          <ActivityIcon
                            className="shrink-0 text-base"
                            style={{ color: ACTIVITY_COLORS[w.sub_activity] }}
                          />
                          <span className="min-w-0 truncate opacity-70 sm:ml-auto">
                            {translateEnum(dict, "effects", w.effect)}
                          </span>
                        </button>
                        <button
                          type="button"
                          data-testid="week-window-ics"
                          aria-label={dict.ui.addToCalendar}
                          title={dict.ui.addToCalendar}
                          onClick={() =>
                            downloadIcs(
                              `pancha-pakshi-${w.effective_date}-${w.id}.ics`,
                              buildIcs([toIcsEvent(w)]),
                            )
                          }
                          className="shrink-0 rounded-md border border-black/5 px-1 py-1 text-xs opacity-60 hover:border-accent/50 hover:opacity-100 dark:border-white/10"
                        >
                          📅
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

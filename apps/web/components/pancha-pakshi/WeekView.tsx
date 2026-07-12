"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import {
  fetchWindows,
  type ScheduleRequest,
  type WindowEntry,
  type WindowsResponse,
} from "@/lib/api-client";
import { BIRD_ICONS } from "@/components/icons/birds";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { ACTIVITY_COLORS } from "./activityColors";

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

  useEffect(() => {
    let cancelled = false;
    // Resets to loading when the request identity changes; the fetch below is
    // the async work this effect exists to perform.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState("loading");
    fetchWindows({ ...request, days: 7, min_effect: "good" })
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
  }, [request]);

  if (state === "loading") {
    return <p className="py-4 text-sm opacity-70">{dict.ui.weekLoading}</p>;
  }
  if (state === "unavailable" || !data) {
    return (
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
        {dict.ui.weekUnavailable}
      </p>
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 lg:gap-2">
      {days.map((date) => {
        const entries = byDate.get(date) ?? [];
        const heading = new Date(`${date}T12:00:00`).toLocaleDateString(
          locale === "si" ? "si-LK" : "en-US",
          { weekday: "short", month: "short", day: "numeric" },
        );
        return (
          <div key={date} className="rounded-xl border border-black/10 p-2.5 dark:border-white/10">
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
                    <li key={`${w.effective_date}-${w.id}`}>
                      <button
                        type="button"
                        onClick={() => onPickDay(date)}
                        title={`${translateEnum(dict, "birds", w.sub_bird)} · ${translateEnum(dict, "activities", w.sub_activity)} · ${translateEnum(dict, "effects", w.effect)}`}
                        className="flex w-full items-center gap-1 rounded-md border border-black/5 px-1.5 py-1 text-left text-xs hover:border-accent/50 dark:border-white/10"
                        style={{ borderLeftWidth: 3, borderLeftColor: ACTIVITY_COLORS[w.sub_activity] }}
                      >
                        <span className="tabular-nums">
                          {formatTime(w.starts_at, locale)}
                        </span>
                        <BirdIcon className="shrink-0 text-sm opacity-80" />
                        <ActivityIcon
                          className="shrink-0 text-sm"
                          style={{ color: ACTIVITY_COLORS[w.sub_activity] }}
                        />
                        <span className="ml-auto opacity-70">
                          {translateEnum(dict, "effects", w.effect)}
                        </span>
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
  );
}

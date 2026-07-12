"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { ScheduleResponse } from "@/lib/api-client";
import { ACTIVITY_COLORS } from "./activityColors";

function pct(fromMs: number, toMs: number, totalMs: number) {
  return ((toMs - fromMs) / totalMs) * 100;
}

// Proportional sunrise→next-sunrise bar: 50 sub-period segments sized by real
// duration, day half warm-tinted / night half cool-tinted, with a "now"
// marker that repositions every 30s. Purely a navigation/overview aid — the
// detailed cards below remain the accessible source of the same data.
export function DayTimelineBar({
  schedule,
  onSelectMajor,
  skewMs = 0,
}: {
  schedule: ScheduleResponse;
  onSelectMajor: (majorIndex: number) => void;
  // Server-vs-client clock offset (same value LiveCountdown uses). Without
  // it, the gliding marker (client clock) and the is_current ring (server
  // clock) disagree on wrong-clocked devices — two contradicting "now"s.
  skewMs?: number;
}) {
  const { dict, locale } = useLocale();
  // State holds the raw client clock; the skew is applied at render time
  // below, so a skew change reflects immediately without needing a setState
  // inside the effect.
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const nowMs = clientNowMs + skewMs;

  useEffect(() => {
    const interval = window.setInterval(() => setClientNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const startMs = new Date(schedule.sunrise).getTime();
  const sunsetMs = new Date(schedule.sunset).getTime();
  const endMs = new Date(schedule.next_sunrise).getTime();
  const totalMs = endMs - startMs;
  if (totalMs <= 0) return null;

  const dayPct = pct(startMs, sunsetMs, totalMs);
  const nowPct = nowMs >= startMs && nowMs < endMs ? pct(startMs, nowMs, totalMs) : null;

  const timeFormat = new Intl.DateTimeFormat(locale === "si" ? "si-LK" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print:hidden">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[560px]">
          <div
            role="group"
            aria-label={dict.ui.dayTimelineBar}
            className="relative h-9 overflow-hidden rounded-lg"
          >
            {/* Day/night tint layer behind the activity segments. */}
            <div aria-hidden className="absolute inset-0 flex">
              <div style={{ width: `${dayPct}%` }} className="bg-amber-200/60 dark:bg-amber-500/15" />
              <div style={{ width: `${100 - dayPct}%` }} className="bg-indigo-950/15 dark:bg-indigo-400/10" />
            </div>

            <div className="absolute inset-0 flex">
              {schedule.major_periods.map((major) =>
                major.sub_periods.map((sp) => {
                  const w = pct(new Date(sp.starts_at).getTime(), new Date(sp.ends_at).getTime(), totalMs);
                  const label = `${timeFormat.format(new Date(sp.starts_at))} – ${timeFormat.format(
                    new Date(sp.ends_at),
                  )} · ${translateEnum(dict, "birds", sp.sub_bird)} · ${translateEnum(
                    dict,
                    "activities",
                    sp.sub_activity,
                  )}`;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      title={label}
                      aria-label={label}
                      aria-current={sp.is_current ? "time" : undefined}
                      onClick={() => onSelectMajor(major.index)}
                      style={{ width: `${w}%`, backgroundColor: ACTIVITY_COLORS[sp.sub_activity] }}
                      className={
                        sp.is_current
                          ? "relative z-10 h-full rounded-sm opacity-100 ring-2 ring-white dark:ring-white/80"
                          : "h-full opacity-60 transition-opacity hover:opacity-90 focus-visible:opacity-100"
                      }
                    />
                  );
                }),
              )}
            </div>

            {nowPct !== null && (
              <div
                aria-hidden
                style={{ left: `${nowPct}%` }}
                className="now-marker pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-foreground"
              >
                <div className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-foreground" />
              </div>
            )}
          </div>

          <div className="mt-1 flex justify-between text-[11px] opacity-70">
            <span>
              {dict.ui.sunrise} {timeFormat.format(new Date(schedule.sunrise))}
            </span>
            <span>
              {dict.ui.sunset} {timeFormat.format(new Date(schedule.sunset))}
            </span>
            <span>
              {dict.ui.nextSunrise} {timeFormat.format(new Date(schedule.next_sunrise))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useLocale } from "@/lib/locale-context";

export type TargetDateTime = { date: string; time: string };

export function nowAsTargetDateTime(timeZone?: string, at: Date = new Date()): TargetDateTime {
  const now = at;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(now);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return {
        date: `${values.year}-${values.month}-${values.day}`,
        time: `${values.hour}:${values.minute}:00`,
      };
    } catch {
      // Fall back to the browser clock if the supplied timezone is invalid.
    }
  }
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
  };
}

export function TargetDateTimeFields({
  value,
  onChange,
  dateLabelKey = "targetDate",
  timeLabelKey = "targetTime",
}: {
  value: TargetDateTime;
  onChange: (next: TargetDateTime) => void;
  dateLabelKey?: "targetDate" | "birthDate";
  timeLabelKey?: "targetTime" | "birthTime";
}) {
  const { dict } = useLocale();
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="opacity-70">{dict.ui[dateLabelKey]}</span>
        <input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="opacity-70">{dict.ui[timeLabelKey]}</span>
        <input
          type="time"
          step={1}
          value={value.time}
          onChange={(e) => onChange({ ...value, time: e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value })}
          className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        />
      </label>
    </div>
  );
}

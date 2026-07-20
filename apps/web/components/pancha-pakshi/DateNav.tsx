"use client";

import { useRef } from "react";
import { useLocale } from "@/lib/locale-context";

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`); // noon avoids DST-midnight edge shifts
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function boundIso(offsetDays: number): string {
  return shiftDate(new Date().toISOString().slice(0, 10), offsetDays);
}

export function DateNav({
  date,
  onChange,
}: {
  date: string; // YYYY-MM-DD currently displayed
  onChange: (date: string) => void;
}) {
  const { dict, locale } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const min = boundIso(-366);
  const max = boundIso(366);

  const display = new Date(`${date}T12:00:00`).toLocaleDateString(
    locale === "si" ? "si-LK" : "en-US",
    { weekday: "short", year: "numeric", month: "short", day: "numeric" },
  );

  return (
    <div className="flex items-center gap-1 print:hidden">
      <button
        type="button"
        aria-label={dict.ui.previousDay}
        onClick={() => onChange(shiftDate(date, -1))}
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        ←
      </button>
      <label className="relative rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium dark:border-white/20">
        {display}
        <input
          ref={inputRef}
          type="date"
          value={date}
          min={min}
          max={max}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={() => inputRef.current?.showPicker?.()}
          aria-label={dict.ui.pickDate}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <button
        type="button"
        aria-label={dict.ui.nextDay}
        onClick={() => onChange(shiftDate(date, 1))}
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        →
      </button>
    </div>
  );
}

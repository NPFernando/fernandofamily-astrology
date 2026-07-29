"use client";

import { useLocale } from "@/lib/locale-context";

export function BirthCalculationHandoffNotice({ onStartFresh }: { onStartFresh: () => void }) {
  const { dict } = useLocale();

  return (
    <div
      role="status"
      data-testid="birth-calculation-handoff"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm"
    >
      <span>{dict.ui.usingPreviousCalculation}</span>
      <button type="button" onClick={onStartFresh} className="rounded-lg border border-accent/35 px-3 py-1.5 font-semibold text-accent">
        {dict.ui.startFresh}
      </button>
    </div>
  );
}

"use client";

import { useLocale } from "@/lib/locale-context";

// Layout-matched placeholder while a schedule computes, so the page doesn't
// jump when the result lands. Pulse is motion-safe only; screen readers get
// the plain loading announcement instead of the decorative blocks.
export function ScheduleSkeleton() {
  const { dict } = useLocale();
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{dict.ui.loading}</span>
      <div aria-hidden className="flex flex-col gap-4 motion-safe:animate-pulse">
        <div className="h-32 rounded-xl border border-black/10 bg-black/[.04] dark:border-white/10 dark:bg-white/[.06]" />
        <div className="h-24 rounded-xl border border-black/10 bg-black/[.04] dark:border-white/10 dark:bg-white/[.06]" />
        <div className="h-9 rounded-lg bg-black/[.04] dark:bg-white/[.06]" />
        <div className="flex flex-col gap-2">
          <div className="h-12 rounded-xl bg-black/[.04] dark:bg-white/[.06]" />
          <div className="h-12 rounded-xl bg-black/[.04] dark:bg-white/[.06]" />
          <div className="h-12 rounded-xl bg-black/[.04] dark:bg-white/[.06]" />
        </div>
      </div>
    </div>
  );
}

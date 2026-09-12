"use client";

import Link from "next/link";

export type MobileAction = {
  label: string;
  href: string;
  primary?: boolean;
};

// Keeps the most useful next actions reachable without forcing a mobile user
// to scroll back through a long result. Links carry only a route/date, never
// birth details, coordinates, or other private calculator inputs.
export function MobileActionBar({ label, actions }: { label: string; actions: MobileAction[] }) {
  return (
    <nav aria-label={label} className="sticky bottom-3 z-20 -mx-1 mt-2 flex gap-2 overflow-x-auto rounded-xl border border-black/10 bg-background/95 p-2 shadow-lg backdrop-blur md:hidden dark:border-white/15">
      {actions.map((action) => (
        <Link
          key={`${action.label}-${action.href}`}
          href={action.href}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
            action.primary ? "bg-accent text-white" : "border border-black/10 dark:border-white/20"
          }`}
        >
          {action.label}
        </Link>
      ))}
    </nav>
  );
}

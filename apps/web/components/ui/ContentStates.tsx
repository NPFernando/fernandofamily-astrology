"use client";

export function LoadingCards({
  label,
  count = 4,
  className = "",
}: {
  label: string;
  count?: number;
  className?: string;
}) {
  return (
    <div role="status" className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          aria-hidden
          className="h-28 rounded-xl border border-black/10 bg-white/25 motion-safe:animate-pulse dark:border-white/10 dark:bg-white/[.04]"
        />
      ))}
    </div>
  );
}

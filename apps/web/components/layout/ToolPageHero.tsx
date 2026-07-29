import type { ReactNode } from "react";

export function ToolPageHero({
  icon,
  title,
  description,
  eyebrow,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  eyebrow: string;
  children?: ReactNode;
}) {
  return (
    <header className="heritage-card relative overflow-hidden rounded-2xl border p-5 sm:p-7">
      <span aria-hidden className="heritage-ornament absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-70" />
      <div className="relative max-w-3xl">
        <div className="flex items-center gap-3 text-accent">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-background/60 text-3xl shadow-sm">
            {icon}
          </span>
          <span className="text-xs font-bold uppercase tracking-[0.16em]">{eyebrow}</span>
        </div>
        <h1 className="heritage-display mt-4 text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl leading-relaxed opacity-80">{description}</p>}
        {children}
      </div>
    </header>
  );
}

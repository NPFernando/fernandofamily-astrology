"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { enabledFeatures } from "@/lib/feature-registry";
import { resolveKey } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";

export function CommandPalette() {
  const { dict, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useMemo(() => [
    ...enabledFeatures().map((feature) => ({ href: `/${locale}${feature.route}`, label: resolveKey(dict, feature.titleKey) })),
    { href: `/${locale}/daily-guide/planner`, label: dict.dailyGuide.plannerTitle },
    { href: `/${locale}/roadmap`, label: dict.roadmap.title },
    { href: `/${locale}/privacy`, label: dict.nav.privacy },
  ], [dict, locale]);
  const visible = commands.filter((command) => command.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const key = event.key.toLowerCase();
      if ((key === "k" && (event.metaKey || event.ctrlKey)) || (key === "/" && !target?.matches("input, textarea, select, [contenteditable='true']"))) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-black/10 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10" aria-label={dict.ui.commandPalette}>
        ⌘K
      </button>
      {open && <div role="dialog" aria-modal="true" aria-label={dict.ui.commandPalette} className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 p-4 pt-[15vh]" onMouseDown={() => setOpen(false)}><div className="w-full max-w-lg rounded-xl border border-black/10 bg-background p-3 shadow-2xl dark:border-white/20" onMouseDown={(event) => event.stopPropagation()}><label className="sr-only" htmlFor="command-palette-query">{dict.ui.commandPaletteSearch}</label><input id="command-palette-query" ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={dict.ui.commandPaletteSearch} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/20" /> <ul className="mt-2 max-h-72 overflow-y-auto">{visible.length ? visible.map((command) => <li key={command.href}><Link href={command.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-accent/10">{command.label}</Link></li>) : <li className="px-3 py-2 text-sm opacity-70">{dict.ui.commandPaletteEmpty}</li>}</ul></div></div>}
    </>
  );
}

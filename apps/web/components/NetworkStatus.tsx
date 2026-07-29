"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";

export function NetworkStatus() {
  const { dict } = useLocale(); const [online, setOnline] = useState(true);
  useEffect(() => { const sync = () => setOnline(navigator.onLine); sync(); window.addEventListener("online", sync); window.addEventListener("offline", sync); return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); }; }, []);
  if (online) return null;
  return <div role="status" aria-live="polite" className="border-b border-amber-700/30 bg-amber-100/80 px-4 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"><strong>{dict.ui.offline}.</strong> {dict.ui.offlineCachedNotice}</div>;
}

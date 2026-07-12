"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { SubPeriod } from "@/lib/api-client";
import { BIRD_ICONS } from "@/components/icons/birds";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { ACTIVITY_COLORS } from "./activityColors";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Slim fixed bar that appears once the main countdown card scrolls out of
// view, keeping the live period visible while browsing the timetable.
// `watchRef` is the main card's element; IntersectionObserver toggles us.
export function StickyCurrentBar({
  current,
  skewMs = 0,
  watchRef,
}: {
  current: SubPeriod | null;
  skewMs?: number;
  watchRef: React.RefObject<HTMLElement | null>;
}) {
  const { dict } = useLocale();
  const [cardVisible, setCardVisible] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const skewRef = useRef(skewMs);
  useEffect(() => {
    skewRef.current = skewMs;
  }, [skewMs]);

  useEffect(() => {
    const el = watchRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setCardVisible(entries[0]?.isIntersecting ?? true),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [watchRef]);

  const showing = !cardVisible && current !== null;

  useEffect(() => {
    if (!showing) return;
    const interval = window.setInterval(() => setNow(Date.now() + skewRef.current), 1000);
    return () => window.clearInterval(interval);
  }, [showing]);

  if (!showing || !current) return null;

  const remaining = new Date(current.ends_at).getTime() - now;
  if (remaining <= 0) return null;

  const BirdIcon = BIRD_ICONS[current.sub_bird];
  const ActivityIcon = ACTIVITY_ICONS[current.sub_activity];

  return (
    <div
      role="status"
      className="motion-safe:animate-panel-in fixed inset-x-0 top-0 z-40 border-b border-accent/30 bg-background/95 px-4 py-2 shadow-sm backdrop-blur print:hidden"
    >
      <div className="mx-auto flex max-w-4xl items-center gap-2 text-sm">
        <span className="text-xs uppercase opacity-60">{dict.ui.liveNow}</span>
        <span className="font-bold tabular-nums text-accent">{formatDuration(remaining)}</span>
        <BirdIcon className="shrink-0 text-base opacity-80" />
        {translateEnum(dict, "birds", current.sub_bird)}
        <ActivityIcon
          className="shrink-0 text-base"
          style={{ color: ACTIVITY_COLORS[current.sub_activity] }}
        />
        {translateEnum(dict, "activities", current.sub_activity)}
      </div>
    </div>
  );
}

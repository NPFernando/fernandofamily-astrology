"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import type { SubPeriod } from "@/lib/api-client";
import { BIRD_ICONS } from "@/components/icons/birds";
import { ACTIVITY_ICONS } from "@/components/icons/activities";
import { ACTIVITY_COLORS } from "./activityColors";
import { subPeriodGuidance } from "@/lib/pancha-guidance";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function LiveCountdown({
  current,
  next,
  serverTime,
  fetchedAtClientMs,
  onExpire,
  isStale = false,
}: {
  current: SubPeriod | null;
  next: SubPeriod | null;
  serverTime: Date | null;
  fetchedAtClientMs: number;
  onExpire: () => void;
  isStale?: boolean;
}) {
  const { dict, locale } = useLocale();
  // Compute the client/server clock offset once per fetch, then apply it
  // locally every tick rather than trusting the client clock raw.
  const skewMsRef = useRef(0);
  useEffect(() => {
    skewMsRef.current = serverTime ? serverTime.getTime() - fetchedAtClientMs : 0;
  }, [serverTime, fetchedAtClientMs]);

  // skewMsRef is always still 0 at first render (the effect above hasn't run
  // yet), so the initial value is just Date.now() — no ref read needed here.
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const interval = window.setInterval(() => {
      setNow(Date.now() + skewMsRef.current);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [current?.id]);

  // The listeners below live for the component's whole life ([] deps), but
  // onExpire is recreated whenever the page's lastRequest changes — capturing
  // it directly would refetch the FIRST schedule forever (tab-restore after
  // computing a second schedule clobbered it with the old one). Route calls
  // through a ref that always holds the latest callback instead.
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "visible") onExpireRef.current();
    }
    function onOnline() {
      onExpireRef.current();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const endsAtMs = current ? new Date(current.ends_at).getTime() : null;
  const remainingMs = endsAtMs !== null ? endsAtMs - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;

  // Never render an expired period as current — trigger a refetch instead of
  // showing a stale or negative countdown. This runs as an effect (not during
  // render) so reading/resetting the ref is safe; the ref just guards against
  // calling onExpire more than once per period while waiting for a refetch.
  useEffect(() => {
    if (expired && !expiredRef.current && !isStale) {
      expiredRef.current = true;
      onExpire();
    }
  }, [expired, isStale, onExpire]);

  if (!current) {
    return <p className="text-sm opacity-70">{dict.ui.loading}</p>;
  }

  // current is narrowed non-null past this point; recompute plainly rather
  // than threading the nullable value computed above through JSX.
  const remaining = new Date(current.ends_at).getTime() - now;
  const inFinalMinute = remaining > 0 && remaining <= 60_000 && !isStale;
  const MainBirdIcon = BIRD_ICONS[current.main_bird];
  const MainActivityIcon = ACTIVITY_ICONS[current.main_activity];
  const SubBirdIcon = BIRD_ICONS[current.sub_bird];
  const SubActivityIcon = ACTIVITY_ICONS[current.sub_activity];
  const guidance = subPeriodGuidance(dict, current);

  return (
    // Keyed by period id: a period change remounts the card, which retriggers
    // the one-shot glow animation (no-op under prefers-reduced-motion).
    <div
      key={current.id}
      className="animate-period-change flex flex-col gap-1 rounded-xl border border-accent/30 bg-accent/5 p-4"
    >
      {isStale && (
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">{dict.ui.offlineCachedNotice}</p>
      )}
      <span className="text-xs uppercase opacity-70">{dict.ui.liveNow}</span>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-3xl font-bold tabular-nums text-accent ${inFinalMinute ? "animate-final-minute" : ""}`}
        >
          {remaining > 0 ? formatDuration(remaining) : "00:00"}
        </span>
        <span className="text-xs opacity-70">{dict.ui.timeRemaining}</span>
      </div>
      {/* The user's own (main) bird stays constant all day; the sub-bird
          rotates through all five birds every major period. Showing only the
          sub-bird read as "wrong bird" — label both lines explicitly. */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
        <span className="text-xs uppercase opacity-70">{dict.ui.mainBird}:</span>
        <MainBirdIcon className="shrink-0 text-lg opacity-90" />
        {translateEnum(dict, "birds", current.main_bird)} ·{" "}
        <MainActivityIcon className="shrink-0 text-lg" style={{ color: ACTIVITY_COLORS[current.main_activity] }} />
        {translateEnum(dict, "activities", current.main_activity)}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-xs uppercase opacity-70">{dict.ui.subBird}:</span>
        <SubBirdIcon className="shrink-0 text-lg opacity-90" />
        {translateEnum(dict, "birds", current.sub_bird)} ·{" "}
        <SubActivityIcon className="shrink-0 text-lg" style={{ color: ACTIVITY_COLORS[current.sub_activity] }} />
        {translateEnum(dict, "activities", current.sub_activity)}
      </p>
      <p className="text-xs opacity-70">
        {dict.ui.endsAt}: {new Date(current.ends_at).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US")}
      </p>
      <div
        data-testid="live-guidance"
        className="mt-2 rounded-lg border border-black/10 bg-background/70 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/[.04]"
      >
        <p className="font-semibold uppercase opacity-70">{guidance.title}</p>
        <p className="mt-1 opacity-85">{guidance.activity}</p>
        <p className="mt-1 opacity-70">{guidance.effect}</p>
        <p className="mt-1 text-[0.68rem] leading-relaxed opacity-70">{guidance.disclaimer}</p>
      </div>
      {next && (
        <p className="mt-2 text-xs opacity-70">
          {dict.ui.nextPeriod}: {translateEnum(dict, "birds", next.sub_bird)} ·{" "}
          {translateEnum(dict, "activities", next.sub_activity)} @{" "}
          {new Date(next.starts_at).toLocaleTimeString(locale === "si" ? "si-LK" : "en-US")}
        </p>
      )}
    </div>
  );
}

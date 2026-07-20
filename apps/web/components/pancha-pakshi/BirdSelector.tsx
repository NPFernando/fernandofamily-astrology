"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import type { BirdId, BirdSelectionInput } from "@/lib/api-client";
import { LocationPicker, mostRecentLocation, type LocationValue } from "./LocationPicker";
import { TargetDateTimeFields, nowAsTargetDateTime, type TargetDateTime } from "./TargetDateTimeFields";
import { BIRD_ICONS } from "@/components/icons/birds";

const BIRDS: BirdId[] = ["vulture", "owl", "crow", "cock", "peacock"];

export function BirdSelector({ onSubmit }: { onSubmit: (input: BirdSelectionInput) => void }) {
  const { dict } = useLocale();
  const [bird, setBird] = useState<BirdId | null>(null);
  const [target, setTarget] = useState<TargetDateTime>(nowAsTargetDateTime());
  const [targetTouched, setTargetTouched] = useState(false);
  const [location, setLocation] = useState<LocationValue | null>(null);

  useEffect(() => {
    // Carries the last-used location over between method tabs and between
    // Pancha Pakshi and Panchanga, instead of always starting empty. Seeded
    // post-mount (not a lazy initializer) since mostRecentLocation() reads
    // localStorage — matching the hydration-safe pattern LocationPicker
    // itself and PanchangaClient already use.
    const recent = mostRecentLocation();
    if (recent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage.
      setLocation(recent);
      setTarget(nowAsTargetDateTime(recent.iana_tz));
    }
  }, []);

  const canSubmit = bird !== null && location !== null;
  function chooseLocation(next: LocationValue) {
    setLocation(next);
    if (!targetTouched) setTarget(nowAsTargetDateTime(next.iana_tz));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm opacity-70">{dict.ui.selectBird}</p>
        <div className="grid auto-rows-fr grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {BIRDS.map((b) => {
            const Icon = BIRD_ICONS[b];
            return (
              <button
                key={b}
                type="button"
                aria-pressed={bird === b}
                onClick={() => setBird(b)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-tight sm:w-auto sm:justify-start sm:rounded-full sm:px-4 ${
                  bird === b
                    ? "border-accent bg-accent/10 font-semibold text-accent"
                    : "border-black/10 opacity-80 hover:opacity-100 dark:border-white/20"
                }`}
              >
                <Icon className="shrink-0 text-xl" />
                <span>{dict.enums.birds[b]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <TargetDateTimeFields
        value={target}
        onChange={(next) => {
          setTarget(next);
          setTargetTouched(true);
        }}
      />

      <div>
        <p className="mb-2 text-sm opacity-70">{dict.ui.location}</p>
        <LocationPicker value={location} onChange={chooseLocation} />
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() =>
          canSubmit &&
          onSubmit({
            method: "bird",
            bird: bird!,
            target_date: target.date,
            target_time: target.time,
            location_name: location!.name,
            latitude: location!.latitude,
            longitude: location!.longitude,
            iana_tz: location!.iana_tz,
          })
        }
        className="w-fit rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {dict.ui.calculate}
      </button>
    </div>
  );
}

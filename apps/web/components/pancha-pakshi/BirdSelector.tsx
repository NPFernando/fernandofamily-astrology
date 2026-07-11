"use client";

import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import type { BirdId, BirdSelectionInput } from "@/lib/api-client";
import { LocationPicker, type LocationValue } from "./LocationPicker";
import { TargetDateTimeFields, nowAsTargetDateTime, type TargetDateTime } from "./TargetDateTimeFields";
import { BIRD_ICONS } from "@/components/icons/birds";

const BIRDS: BirdId[] = ["vulture", "owl", "crow", "cock", "peacock"];

export function BirdSelector({ onSubmit }: { onSubmit: (input: BirdSelectionInput) => void }) {
  const { dict } = useLocale();
  const [bird, setBird] = useState<BirdId | null>(null);
  const [target, setTarget] = useState<TargetDateTime>(nowAsTargetDateTime());
  const [location, setLocation] = useState<LocationValue | null>(null);

  const canSubmit = bird !== null && location !== null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-sm opacity-70">{dict.ui.selectBird}</p>
        <div className="flex flex-wrap gap-2">
          {BIRDS.map((b) => {
            const Icon = BIRD_ICONS[b];
            return (
              <button
                key={b}
                type="button"
                onClick={() => setBird(b)}
                className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm ${
                  bird === b
                    ? "border-accent bg-accent/10 font-semibold text-accent"
                    : "border-black/10 opacity-80 hover:opacity-100 dark:border-white/20"
                }`}
              >
                <Icon className="text-lg" />
                {dict.enums.birds[b]}
              </button>
            );
          })}
        </div>
      </div>

      <TargetDateTimeFields value={target} onChange={setTarget} />

      <div>
        <p className="mb-2 text-sm opacity-70">{dict.ui.location}</p>
        <LocationPicker value={location} onChange={setLocation} />
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

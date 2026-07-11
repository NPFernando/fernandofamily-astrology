"use client";

import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { NAKSHATRAS, nakshatraName } from "@/lib/i18n";
import type { NakshatraPakshaInput, PakshaId } from "@/lib/api-client";
import { LocationPicker, type LocationValue } from "./LocationPicker";
import { TargetDateTimeFields, nowAsTargetDateTime, type TargetDateTime } from "./TargetDateTimeFields";

export function NakshatraPakshaForm({
  onSubmit,
}: {
  onSubmit: (input: NakshatraPakshaInput) => void;
}) {
  const { dict, locale } = useLocale();
  const [nakshatraId, setNakshatraId] = useState<number | null>(null);
  const [paksha, setPaksha] = useState<PakshaId | null>(null);
  const [target, setTarget] = useState<TargetDateTime>(nowAsTargetDateTime());
  const [location, setLocation] = useState<LocationValue | null>(null);

  const canSubmit = nakshatraId !== null && paksha !== null && location !== null;

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="opacity-70">{dict.ui.selectNakshatra}</span>
        <select
          value={nakshatraId ?? ""}
          onChange={(e) => setNakshatraId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-lg border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-transparent"
        >
          <option value="" disabled>
            {dict.ui.selectNakshatra}
          </option>
          {NAKSHATRAS.map((n) => (
            <option key={n.id} value={n.id}>
              {nakshatraName(n.id, locale)}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-2 text-sm opacity-70">{dict.ui.paksha}</p>
        <div className="flex gap-2">
          {(["waxing", "waning"] as PakshaId[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPaksha(p)}
              className={`rounded-full border px-4 py-2 text-sm ${
                paksha === p
                  ? "border-accent bg-accent/10 font-semibold text-accent"
                  : "border-black/10 opacity-80 hover:opacity-100 dark:border-white/20"
              }`}
            >
              {dict.enums.paksha[p]}
            </button>
          ))}
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
            method: "nakshatra_paksha",
            nakshatra_index: nakshatraId!,
            paksha: paksha!,
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

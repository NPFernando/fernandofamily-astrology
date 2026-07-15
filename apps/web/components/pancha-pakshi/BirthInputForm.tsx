"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { fetchBirthBird, ApiError, type BirdSelectionInput, type BirthBirdResponse } from "@/lib/api-client";
import { LocationPicker, mostRecentLocation, type LocationValue } from "./LocationPicker";
import { TargetDateTimeFields, nowAsTargetDateTime, type TargetDateTime } from "./TargetDateTimeFields";

export function BirthInputForm({ onSubmit }: { onSubmit: (input: BirdSelectionInput) => void }) {
  const { dict } = useLocale();
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [target, setTarget] = useState<TargetDateTime>(nowAsTargetDateTime());
  const [targetTouched, setTargetTouched] = useState(false);
  const [confirmed, setConfirmed] = useState<BirthBirdResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const canConfirm = birthDate && birthTime && location !== null;
  function chooseLocation(next: LocationValue) {
    setLocation(next);
    if (!targetTouched) setTarget(nowAsTargetDateTime(next.iana_tz));
  }

  async function confirmBird() {
    if (!canConfirm) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBirthBird({
        method: "birth_datetime",
        birth_date: birthDate,
        birth_time: birthTime.length === 5 ? `${birthTime}:00` : birthTime,
        target_date: target.date,
        target_time: target.time,
        location_name: location!.name,
        latitude: location!.latitude,
        longitude: location!.longitude,
        iana_tz: location!.iana_tz,
      });
      setConfirmed(result);
    } catch (e) {
      setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
    } finally {
      setLoading(false);
    }
  }

  if (confirmed) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm opacity-70">{dict.ui.confirmBirthBird}</p>
          <p className="text-xl font-semibold text-accent">{dict.enums.birds[confirmed.birth_bird]}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmed(null)}
            className="rounded-lg border border-black/10 px-4 py-2 text-sm dark:border-white/20"
          >
            {dict.ui.back}
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                method: "bird",
                bird: confirmed.birth_bird,
                target_date: target.date,
                target_time: target.time,
                location_name: location!.name,
                latitude: location!.latitude,
                longitude: location!.longitude,
                iana_tz: location!.iana_tz,
              })
            }
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white"
          >
            {dict.ui.proceedToSchedule}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TargetDateTimeFields
        value={{ date: birthDate, time: birthTime }}
        onChange={(v) => {
          setBirthDate(v.date);
          setBirthTime(v.time);
        }}
        dateLabelKey="birthDate"
        timeLabelKey="birthTime"
      />

      <div>
        <p className="mb-2 text-sm opacity-70">{dict.ui.location}</p>
        <LocationPicker value={location} onChange={chooseLocation} />
      </div>

      <details className="text-sm opacity-80">
        <summary className="cursor-pointer">{dict.ui.targetDate}</summary>
        <div className="mt-2">
          <TargetDateTimeFields
            value={target}
            onChange={(next) => {
              setTarget(next);
              setTargetTouched(true);
            }}
          />
        </div>
      </details>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        disabled={!canConfirm || loading}
        onClick={confirmBird}
        className="w-fit rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {loading ? dict.ui.loading : dict.ui.confirm}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { ApiError, fetchDasha, type DashaTimeline as DashaTimelineData } from "@/lib/api-client";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  useVaultRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { TargetDateTimeFields } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { DashaIcon } from "@/components/icons/features";
import { DashaTimeline } from "@/components/dasha/DashaTimeline";
import { useRecentBirthDetails } from "@/lib/recent-birth-details";
import { ResultExplanation } from "@/components/ui/ResultExplanation";
import { usePrivatePeople } from "@/lib/use-private-people";
import { PrivatePersonPicker } from "@/components/private-people/PrivatePersonPicker";
import { PrivatePersonSaveButton } from "@/components/private-people/PrivatePersonSaveButton";

export function DashaClient() {
  const { dict } = useLocale();
  const { recent, saveRecentBirthDetails } = useRecentBirthDetails();
  const privatePeople = usePrivatePeople();
  const vaultLocation = useVaultRecentLocation();
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [result, setResult] = useState<DashaTimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate after mount because recent locations/birth details live in
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate only from the unlocked vault.
    setLocation(vaultLocation ?? DEFAULT_LOCATION);
    if (recent) {

      setBirthDate(recent.birth_date);

      setBirthTime(recent.birth_time);
    }
  }, [recent, vaultLocation]);

  useEffect(() => {
    if (!privatePeople.person) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate form fields when the active encrypted person changes.
    setBirthDate(privatePeople.person.birth_date);
    setBirthTime(privatePeople.person.birth_time);
    setLocation(privatePeople.person.birthplace);
    setResult(null);
  }, [privatePeople.person]);

  async function savePrivatePerson(label: string) {
    if (!birthDate || !birthTime || !location || !privatePeople.unlocked) return;
    await privatePeople.savePerson({ label, birth_date: birthDate, birth_time: birthTime.length === 5 ? `${birthTime}:00` : birthTime, birthplace: location });
  }

  const canCalculate = birthDate !== "" && birthTime !== "" && location !== null;

  async function calculate() {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);
    try {
      const normalizedTime = birthTime.length === 5 ? `${birthTime}:00` : birthTime;
      const data = await fetchDasha({
        birth_date: birthDate,
        birth_time: normalizedTime,
        location_name: location!.name,
        latitude: location!.latitude,
        longitude: location!.longitude,
        iana_tz: location!.iana_tz,
      });
      setResult(data);
      void saveRecentBirthDetails({ birth_date: birthDate, birth_time: normalizedTime });
    } catch (e) {
      setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <DashaIcon className="text-3xl text-accent" />
          {dict.dasha.title}
        </h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">{dict.dasha.description}</p>
      </header>

      <section
        data-testid="dasha-controls"
        className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {dict.dasha.birthDetailsTitle}
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <PrivatePersonPicker people={privatePeople.people} selectedId={privatePeople.selectedId} unlocked={privatePeople.unlocked} onSelect={privatePeople.selectPerson} onDelete={privatePeople.removePerson} />
          <TargetDateTimeFields
            value={{ date: birthDate, time: birthTime }}
            onChange={(value) => {
              setBirthDate(value.date);
              setBirthTime(value.time);
            }}
            dateLabelKey="birthDate"
            timeLabelKey="birthTime"
          />
          <div>
            <p className="mb-2 text-sm opacity-70">{dict.ui.location}</p>
            <LocationPicker value={location} onChange={setLocation} />
          </div>
          <button
            type="button"
            disabled={!canCalculate || loading}
            onClick={calculate}
            className="w-fit rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {loading ? dict.ui.loading : dict.dasha.calculate}
          </button>
          {privatePeople.unlocked && <PrivatePersonSaveButton disabled={!canCalculate} onSave={savePrivatePerson} />}
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
        </div>
      )}

      {loading && !result && (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">{dict.ui.loading}</span>
          <div aria-hidden className="flex flex-col gap-2 skeleton-shimmer">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl border border-black/10 bg-black/[.04] dark:border-white/10 dark:bg-white/[.06]"
              />
            ))}
          </div>
        </div>
      )}

      {result && (
        <section data-testid="dasha-result" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase text-accent">{dict.dasha.resultTitle}</h2>
          <ResultExplanation title={dict.ui.resultGuideTitle} body={dict.ui.resultGuideBody} />
          <DashaTimeline periods={result.periods} />
        </section>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { ApiError, fetchNavamsaChart, type NavamsaChart as NavamsaChartData } from "@/lib/api-client";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { TargetDateTimeFields } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { DivisionalChartsIcon } from "@/components/icons/features";
import { NavamsaChart } from "@/components/divisional-charts/NavamsaChart";
import { mostRecentBirthDetails, saveRecentBirthDetails } from "@/lib/recent-birth-details";

export function DivisionalChartsClient() {
  const { dict } = useLocale();
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [result, setResult] = useState<NavamsaChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate after mount because recent locations/birth details live in
    // localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage.
    setLocation(mostRecentLocation() ?? DEFAULT_LOCATION);
    const recent = mostRecentBirthDetails();
    if (recent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage.
      setBirthDate(recent.birth_date);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage.
      setBirthTime(recent.birth_time);
    }
  }, []);

  const canCalculate = birthDate !== "" && birthTime !== "" && location !== null;

  async function calculate() {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);
    try {
      const normalizedTime = birthTime.length === 5 ? `${birthTime}:00` : birthTime;
      const data = await fetchNavamsaChart({
        birth_date: birthDate,
        birth_time: normalizedTime,
        location_name: location!.name,
        latitude: location!.latitude,
        longitude: location!.longitude,
        iana_tz: location!.iana_tz,
      });
      setResult(data);
      saveRecentBirthDetails({ birth_date: birthDate, birth_time: normalizedTime });
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
          <DivisionalChartsIcon className="text-3xl text-accent" />
          {dict.divisionalCharts.title}
        </h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">
          {dict.divisionalCharts.description}
        </p>
      </header>

      <section
        data-testid="divisional-charts-controls"
        className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {dict.divisionalCharts.birthDetailsTitle}
        </h2>
        <div className="mt-4 flex flex-col gap-4">
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
            {loading ? dict.ui.loading : dict.divisionalCharts.calculate}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
        </div>
      )}

      {loading && !result && (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{dict.ui.loading}</span>
          <div aria-hidden className="motion-safe:animate-pulse">
            <div className="aspect-square max-w-md rounded-xl border border-black/10 bg-black/[.04] dark:border-white/10 dark:bg-white/[.06]" />
          </div>
        </div>
      )}

      {result && (
        <section data-testid="divisional-charts-result" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase text-accent">{dict.divisionalCharts.chartTitle}</h2>
          <NavamsaChart chart={result} />
        </section>
      )}
    </div>
  );
}

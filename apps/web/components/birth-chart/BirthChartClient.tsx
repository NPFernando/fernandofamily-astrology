"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { ApiError, fetchBirthChart, type BirthChart as BirthChartData } from "@/lib/api-client";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { TargetDateTimeFields } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { FullMoonIcon } from "@/components/icons/moon";
import { BirthChartChart } from "@/components/birth-chart/BirthChartChart";
import { YogataraTable } from "@/components/birth-chart/YogataraTable";

export function BirthChartClient() {
  const { dict } = useLocale();
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [result, setResult] = useState<BirthChartData | null>(null);
  const [showStars, setShowStars] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate after mount because recent locations live in localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage.
    setLocation(mostRecentLocation() ?? DEFAULT_LOCATION);
  }, []);

  const canCalculate = birthDate !== "" && birthTime !== "" && location !== null;

  async function calculate() {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBirthChart({
        birth_date: birthDate,
        birth_time: birthTime.length === 5 ? `${birthTime}:00` : birthTime,
        location_name: location!.name,
        latitude: location!.latitude,
        longitude: location!.longitude,
        iana_tz: location!.iana_tz,
      });
      setResult(data);
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
          <FullMoonIcon className="text-3xl text-accent" />
          {dict.birthChart.title}
        </h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">{dict.birthChart.description}</p>
      </header>

      <section
        data-testid="birth-chart-controls"
        className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {dict.birthChart.birthDetailsTitle}
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
            {loading ? dict.ui.loading : dict.birthChart.calculate}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
        </div>
      )}

      {result && (
        <section data-testid="birth-chart-result" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase text-accent">{dict.birthChart.chartTitle}</h2>
            <button
              type="button"
              aria-pressed={showStars}
              data-testid="yogatara-toggle"
              onClick={() => setShowStars((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                showStars
                  ? "bg-accent text-white"
                  : "border border-black/15 bg-white/40 opacity-70 dark:border-white/15 dark:bg-white/[.04]"
              }`}
            >
              {dict.birthChart.starsToggle}
            </button>
          </div>
          <BirthChartChart chart={result} showStars={showStars} />
          <YogataraTable rows={result.graha_yogataras} />
        </section>
      )}
    </div>
  );
}

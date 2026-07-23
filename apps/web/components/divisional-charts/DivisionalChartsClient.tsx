"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import {
  ApiError,
  fetchDasamsaChart,
  fetchNavamsaChart,
  fetchSaptamsaChart,
  type DasamsaChart as DasamsaChartData,
  type NavamsaChart as NavamsaChartData,
  type SaptamsaChart as SaptamsaChartData,
} from "@/lib/api-client";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { TargetDateTimeFields } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { DivisionalChartsIcon } from "@/components/icons/features";
import { NavamsaChart } from "@/components/divisional-charts/NavamsaChart";
import { DasamsaChart } from "@/components/divisional-charts/DasamsaChart";
import { SaptamsaChart } from "@/components/divisional-charts/SaptamsaChart";
import { mostRecentBirthDetails, saveRecentBirthDetails } from "@/lib/recent-birth-details";

type ChartType = "navamsa" | "dasamsa" | "saptamsa";

export function DivisionalChartsClient() {
  const { dict } = useLocale();
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [navamsaResult, setNavamsaResult] = useState<NavamsaChartData | null>(null);
  const [dasamsaResult, setDasamsaResult] = useState<DasamsaChartData | null>(null);
  const [saptamsaResult, setSaptamsaResult] = useState<SaptamsaChartData | null>(null);
  const [chartType, setChartType] = useState<ChartType>("navamsa");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const result =
    chartType === "navamsa" ? navamsaResult : chartType === "dasamsa" ? dasamsaResult : saptamsaResult;

  const tabs: { id: ChartType; label: string }[] = [
    { id: "navamsa", label: dict.divisionalCharts.navamsaTab },
    { id: "dasamsa", label: dict.divisionalCharts.dasamsaTab },
    { id: "saptamsa", label: dict.divisionalCharts.saptamsaTab },
  ];

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
      const requestBody = {
        birth_date: birthDate,
        birth_time: normalizedTime,
        location_name: location!.name,
        latitude: location!.latitude,
        longitude: location!.longitude,
        iana_tz: location!.iana_tz,
      };
      // All three charts share identical birth-data input, so compute all
      // of them from a single "Calculate" press -- switching tabs
      // afterwards is then instant, not a second network round-trip.
      const [navamsa, dasamsa, saptamsa] = await Promise.all([
        fetchNavamsaChart(requestBody),
        fetchDasamsaChart(requestBody),
        fetchSaptamsaChart(requestBody),
      ]);
      setNavamsaResult(navamsa);
      setDasamsaResult(dasamsa);
      setSaptamsaResult(saptamsa);
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
          <div
            role="tablist"
            aria-label={dict.divisionalCharts.title}
            className="flex gap-2 border-b border-black/10 dark:border-white/10"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={chartType === tab.id}
                data-testid={`divisional-charts-tab-${tab.id}`}
                onClick={() => setChartType(tab.id)}
                className={`px-3 py-2 text-sm ${
                  chartType === tab.id
                    ? "border-b-2 border-accent font-semibold text-accent"
                    : "opacity-70 hover:opacity-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <h2 className="text-sm font-semibold uppercase text-accent">
            {chartType === "navamsa"
              ? dict.divisionalCharts.chartTitle
              : chartType === "dasamsa"
                ? dict.divisionalCharts.dasamsaChartTitle
                : dict.divisionalCharts.saptamsaChartTitle}
          </h2>
          {chartType === "navamsa" && navamsaResult && <NavamsaChart chart={navamsaResult} />}
          {chartType === "dasamsa" && dasamsaResult && <DasamsaChart chart={dasamsaResult} />}
          {chartType === "saptamsa" && saptamsaResult && <SaptamsaChart chart={saptamsaResult} />}
        </section>
      )}
    </div>
  );
}

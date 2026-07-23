"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { ApiError, fetchPorondamMatch, type PorondamResponse } from "@/lib/api-client";
import { nakshatraName, translateEnum } from "@/lib/i18n";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { TargetDateTimeFields, type TargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { saveRecentBirthDetails } from "@/lib/recent-birth-details";
import { PorondamIcon } from "@/components/icons/features";

// Fixed display order matching repository.py / calculator.compute_porondam.
const PORONDAM_ORDER = [
  "nakshatra",
  "gana",
  "yoni",
  "rashi",
  "rashyadpathi",
  "vashya",
  "vedha",
] as const;

type PartyState = {
  dateTime: TargetDateTime;
  location: LocationValue | null;
};

function emptyParty(): PartyState {
  return { dateTime: { date: "", time: "" }, location: null };
}

export function PorondamClient() {
  const { dict } = useLocale();
  const [bride, setBride] = useState<PartyState>(emptyParty());
  const [groom, setGroom] = useState<PartyState>(emptyParty());
  const [result, setResult] = useState<PorondamResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate after mount because recent locations live in localStorage.
    const recent = mostRecentLocation() ?? DEFAULT_LOCATION;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage.
    setBride((b) => (b.location ? b : { ...b, location: recent }));
    setGroom((g) => (g.location ? g : { ...g, location: recent }));
  }, []);

  const canCalculate =
    bride.dateTime.date !== "" &&
    bride.dateTime.time !== "" &&
    bride.location !== null &&
    groom.dateTime.date !== "" &&
    groom.dateTime.time !== "" &&
    groom.location !== null;

  async function calculate() {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPorondamMatch({
        bride: partyToInput(bride),
        groom: partyToInput(groom),
      });
      setResult(data);
      // Contributes to the shared recent-birth-details list (birth-chart/
      // dasha/divisional-charts benefit from it too) — but Porondam itself
      // deliberately does NOT auto-fill from it on mount, since bride and
      // groom are two different people and there's no way to know which
      // saved entry maps to which role.
      saveRecentBirthDetails({ birth_date: bride.dateTime.date, birth_time: partyToInput(bride).birth_time });
      saveRecentBirthDetails({ birth_date: groom.dateTime.date, birth_time: partyToInput(groom).birth_time });
    } catch (e) {
      setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
    } finally {
      setLoading(false);
    }
  }

  function partyToInput(party: PartyState) {
    return {
      birth_date: party.dateTime.date,
      birth_time: party.dateTime.time.length === 5 ? `${party.dateTime.time}:00` : party.dateTime.time,
      location_name: party.location!.name,
      latitude: party.location!.latitude,
      longitude: party.location!.longitude,
      iana_tz: party.location!.iana_tz,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <PorondamIcon className="text-3xl text-accent" />
          {dict.porondam.title}
        </h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">
          {dict.porondam.description}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <PartyForm label={dict.porondam.brideTitle} value={bride} onChange={setBride} />
        <PartyForm label={dict.porondam.groomTitle} value={groom} onChange={setGroom} />
      </div>

      <button
        type="button"
        disabled={!canCalculate || loading}
        onClick={calculate}
        className="w-fit rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {loading ? dict.ui.loading : dict.porondam.calculate}
      </button>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
        </div>
      )}

      {loading && !result && (
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">{dict.ui.loading}</span>
          <div aria-hidden className="flex flex-col gap-3 motion-safe:animate-pulse">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-16 rounded-lg border border-black/10 bg-black/[.04] dark:border-white/10 dark:bg-white/[.06]" />
              <div className="h-16 rounded-lg border border-black/10 bg-black/[.04] dark:border-white/10 dark:bg-white/[.06]" />
            </div>
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-black/[.04] dark:bg-white/[.06]"
              />
            ))}
          </div>
        </div>
      )}

      {result && (
        <section data-testid="porondam-result" className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase text-accent">{dict.porondam.resultTitle}</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <PartySummary label={dict.porondam.brideLabel} data={result.bride} />
            <PartySummary label={dict.porondam.groomLabel} data={result.groom} />
          </div>

          <p className="text-sm font-semibold">
            {dict.porondam.summaryLabel}: {result.result.passed_count} / {result.result.checked_count}
          </p>

          <div
            data-testid="porondam-matches"
            className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
          >
            {PORONDAM_ORDER.map((key) => {
              const match = result.result.matches.find((m) => m.key === key);
              if (!match) return null;
              const category = dict.porondam.categories[key];
              return (
                <div
                  key={key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-black/10 px-3 py-3 text-sm first:border-t-0 dark:border-white/10"
                >
                  <div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="mt-0.5 opacity-70">{category.description}</p>
                  </div>
                  <span
                    className={`h-fit rounded-full border px-3 py-1 text-xs font-semibold ${
                      match.passed
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                        : "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200"
                    }`}
                  >
                    {match.passed ? dict.porondam.passLabel : dict.porondam.failLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="rounded-lg border border-black/10 bg-white/25 p-4 text-sm opacity-80 dark:border-white/10 dark:bg-white/[.03]">
        {dict.porondam.note}
      </p>
    </div>
  );
}

function PartyForm({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PartyState;
  onChange: (next: PartyState) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-accent">{label}</legend>
      <div className="mt-3 flex flex-col gap-4">
        <TargetDateTimeFields
          value={value.dateTime}
          onChange={(dateTime) => onChange({ ...value, dateTime })}
          dateLabelKey="birthDate"
          timeLabelKey="birthTime"
        />
        <LocationPicker
          value={value.location}
          onChange={(location) => onChange({ ...value, location })}
        />
      </div>
    </fieldset>
  );
}

function PartySummary({
  label,
  data,
}: {
  label: string;
  data: PorondamResponse["bride"];
}) {
  const { dict, locale } = useLocale();
  return (
    <div className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1">{nakshatraName(data.nakshatra_index, locale)}</p>
      <p className="opacity-80">{translateEnum(dict, "rashis", data.rashi_key)}</p>
    </div>
  );
}

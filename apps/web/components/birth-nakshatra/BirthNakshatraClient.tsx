"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { nakshatraName, translateEnum } from "@/lib/i18n";
import {
  ApiError,
  fetchBirthNakshatra,
  type BirthNakshatraResponse,
} from "@/lib/api-client";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { TargetDateTimeFields } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { BirthNakshatraIcon } from "@/components/icons/features";
import { BIRD_ICONS } from "@/components/icons/birds";
import { addProfile } from "@/lib/profiles";
import { useSessionProbe } from "@/lib/use-session-probe";
import { saveDerivedIdentitySeed } from "@/lib/pancha-schedule-state";

export function BirthNakshatraClient() {
  const { dict, locale } = useLocale();
  const router = useRouter();
  const probe = useSessionProbe();
  const signedIn = Boolean(probe.user?.email);
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [result, setResult] = useState<BirthNakshatraResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
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
      const data = await fetchBirthNakshatra({
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

  function seedResult() {
    if (!result) return;
    saveDerivedIdentitySeed({
      bird: result.birth_bird,
      nakshatra_index: result.nakshatra.index,
      paksha: result.paksha,
      moon_rashi_index: result.moon_rashi.index,
    });
  }

  function openTool(path: "/pancha-pakshi" | "/daily-guide") {
    seedResult();
    router.push(`/${locale}${path}`);
  }

  async function saveProfile() {
    if (!result) return;
    const label = window.prompt(dict.ui.profileLabelPrompt)?.trim();
    if (!label) return;
    setSaving(true);
    try {
      await addProfile(signedIn, {
        label,
        bird: null,
        nakshatra_index: result.nakshatra.index,
        paksha: result.paksha,
        moon_rashi_index: result.moon_rashi.index,
      });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BirthNakshatraIcon className="text-3xl text-accent" />
          {dict.birthNakshatra.title}
        </h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">
          {dict.birthNakshatra.description}
        </p>
      </header>

      <section
        data-testid="birth-nakshatra-controls"
        className="rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {dict.birthNakshatra.birthDetailsTitle}
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
            {loading ? dict.ui.loading : dict.birthNakshatra.calculate}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
        </div>
      )}

      {loading && !result && (
        <div role="status" className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <span className="sr-only">{dict.ui.loading}</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="h-20 rounded-lg border border-black/10 bg-black/[.04] motion-safe:animate-pulse dark:border-white/10 dark:bg-white/[.06]"
            />
          ))}
        </div>
      )}

      {result && (
        <section data-testid="birth-nakshatra-result" className="flex flex-col gap-5">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <ResultCard title={dict.birthNakshatra.nakshatra}>
              <p className="text-lg font-semibold">
                {nakshatraName(result.nakshatra.index, locale)}
              </p>
              <p className="text-sm opacity-70">
                {dict.panchanga.pada} {result.nakshatra.pada}
              </p>
            </ResultCard>
            <ResultCard title={dict.ui.paksha}>
              <p className="text-lg font-semibold">{translateEnum(dict, "paksha", result.paksha)}</p>
            </ResultCard>
            <ResultCard title={dict.birthNakshatra.moonRashi}>
              <p className="text-lg font-semibold">{translateEnum(dict, "rashis", result.moon_rashi.key)}</p>
            </ResultCard>
            <ResultCard title={dict.ui.birthBird}>
              <BirthBirdLine result={result} />
            </ResultCard>
          </div>

          <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <h2 className="text-sm font-semibold uppercase text-accent">
              {dict.birthNakshatra.nextActionsTitle}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openTool("/pancha-pakshi")}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                {dict.birthNakshatra.openPanchaPakshi}
              </button>
              <button
                type="button"
                onClick={() => openTool("/daily-guide")}
                className="rounded-lg border border-accent/40 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
              >
                {dict.birthNakshatra.openDailyGuide}
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:border-accent/50 disabled:opacity-50 dark:border-white/20"
              >
                {justSaved ? dict.ui.profileSaved : dict.ui.saveAsProfile}
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed opacity-70">
              {dict.birthNakshatra.privacyNote}
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/30 p-4 dark:border-white/10 dark:bg-white/[.03]">
      <h2 className="text-xs font-semibold uppercase opacity-70">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function BirthBirdLine({ result }: { result: BirthNakshatraResponse }) {
  const { dict } = useLocale();
  const BirdIcon = BIRD_ICONS[result.birth_bird];
  return (
    <p className="flex items-center gap-2 text-lg font-semibold">
      <BirdIcon className="text-2xl" />
      {translateEnum(dict, "birds", result.birth_bird)}
    </p>
  );
}

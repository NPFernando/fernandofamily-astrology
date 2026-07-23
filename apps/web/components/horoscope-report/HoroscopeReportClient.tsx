"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { nakshatraName, translateEnum } from "@/lib/i18n";
import {
  ApiError,
  fetchBirthChart,
  fetchBirthNakshatra,
  fetchDasha,
  type BirthChart as BirthChartData,
  type BirthNakshatraRequest,
  type BirthNakshatraResponse,
  type DashaTimeline as DashaTimelineData,
  type MahadashaPeriod,
  type AntardashaPeriod,
} from "@/lib/api-client";
import {
  DEFAULT_LOCATION,
  LocationPicker,
  mostRecentLocation,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";
import { TargetDateTimeFields } from "@/components/pancha-pakshi/TargetDateTimeFields";
import { HoroscopeReportIcon } from "@/components/icons/features";
import { BIRD_ICONS } from "@/components/icons/birds";
import { BirthChartChart } from "@/components/birth-chart/BirthChartChart";
import { DashaTimeline } from "@/components/dasha/DashaTimeline";
import { addProfile } from "@/lib/profiles";
import { useSessionProbe } from "@/lib/use-session-probe";
import { saveDerivedIdentitySeed } from "@/lib/pancha-schedule-state";
import { mostRecentBirthDetails, saveRecentBirthDetails } from "@/lib/recent-birth-details";

type ReportResult = {
  request: BirthNakshatraRequest;
  identity: BirthNakshatraResponse;
  chart: BirthChartData;
  dasha: DashaTimelineData;
};

type CurrentDasha = {
  mahadasha: MahadashaPeriod;
  antardasha: AntardashaPeriod | null;
} | null;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function findCurrentDasha(periods: MahadashaPeriod[], today: string): CurrentDasha {
  const mahadasha = periods.find((period) => period.start_date <= today && today < period.end_date);
  if (!mahadasha) return null;
  const antardasha = mahadasha.antardashas.find((period) => period.start_date <= today && today < period.end_date) ?? null;
  return { mahadasha, antardasha };
}

async function shareOrDownloadPng(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function replaceTokens(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)), template);
}

export function HoroscopeReportClient() {
  const { dict, locale } = useLocale();
  const router = useRouter();
  const probe = useSessionProbe();
  const signedIn = Boolean(probe.user?.email);
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate after mount because recent locations/birth details live in localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage.
    setLocation(mostRecentLocation() ?? DEFAULT_LOCATION);
    const recent = mostRecentBirthDetails();
    if (recent) {
      setBirthDate(recent.birth_date);
      setBirthTime(recent.birth_time);
    }
  }, []);

  const canCalculate = birthDate !== "" && birthTime !== "" && location !== null;
  const currentDasha = useMemo(() => (result ? findCurrentDasha(result.dasha.periods, todayKey()) : null), [result]);

  async function calculate() {
    if (!canCalculate) return;
    setLoading(true);
    setError(null);
    setShareError(false);
    try {
      const normalizedTime = birthTime.length === 5 ? `${birthTime}:00` : birthTime;
      const request: BirthNakshatraRequest = {
        birth_date: birthDate,
        birth_time: normalizedTime,
        location_name: location!.name,
        latitude: location!.latitude,
        longitude: location!.longitude,
        iana_tz: location!.iana_tz,
      };
      const [identity, chart, dasha] = await Promise.all([
        fetchBirthNakshatra(request),
        fetchBirthChart(request),
        fetchDasha(request),
      ]);
      setResult({ request, identity, chart, dasha });
      saveRecentBirthDetails({ birth_date: birthDate, birth_time: normalizedTime });
    } catch (e) {
      setError(e instanceof ApiError ? dict.ui.error : dict.ui.error);
    } finally {
      setLoading(false);
    }
  }

  function seedIdentity() {
    if (!result) return;
    saveDerivedIdentitySeed({
      bird: result.identity.birth_bird,
      nakshatra_index: result.identity.nakshatra.index,
      paksha: result.identity.paksha,
      moon_rashi_index: result.identity.moon_rashi.index,
    });
  }

  function openTool(path: "/birth-chart" | "/dasha" | "/daily-guide" | "/pancha-pakshi") {
    if (path === "/daily-guide" || path === "/pancha-pakshi") seedIdentity();
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
        nakshatra_index: result.identity.nakshatra.index,
        paksha: result.identity.paksha,
        moon_rashi_index: result.identity.moon_rashi.index,
      });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function shareReport() {
    if (!result) return;
    setSharing(true);
    setShareError(false);
    try {
      const response = await fetch("/api/share-horoscope-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, birth: result.request }),
      });
      if (!response.ok) throw new Error(`share-horoscope-report ${response.status}`);
      await shareOrDownloadPng(await response.blob(), `horoscope-report-${todayKey()}.png`);
    } catch {
      setShareError(true);
    } finally {
      setSharing(false);
    }
  }

  const report = result ? buildReportSummary(result, dict, locale, currentDasha) : null;
  const BirdIcon = result ? BIRD_ICONS[result.identity.birth_bird] : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <HoroscopeReportIcon className="text-3xl text-accent" />
          {dict.horoscopeReport.title}
        </h1>
        <p className="mt-1 text-sm leading-relaxed opacity-80 sm:text-base">{dict.horoscopeReport.description}</p>
      </header>

      <section
        data-testid="horoscope-report-controls"
        className="print:hidden rounded-xl border border-black/10 bg-white/40 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.04]"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
          {dict.horoscopeReport.birthDetailsTitle}
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
            {loading ? dict.ui.loading : dict.horoscopeReport.calculate}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p>{error}</p>
        </div>
      )}

      {loading && !result && (
        <div role="status" className="grid gap-3 md:grid-cols-3">
          <span className="sr-only">{dict.ui.loading}</span>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              aria-hidden
              className="h-24 rounded-xl border border-black/10 bg-black/[.04] motion-safe:animate-pulse dark:border-white/10 dark:bg-white/[.06]"
            />
          ))}
        </div>
      )}

      {result && report && (
        <section data-testid="horoscope-report-result" className="flex flex-col gap-5 print:gap-4">
          <div className="print:hidden rounded-xl border border-black/10 bg-white/30 p-4 dark:border-white/10 dark:bg-white/[.03]">
            <h2 className="text-sm font-semibold uppercase text-accent">{dict.horoscopeReport.actionsTitle}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => window.print()} className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold hover:border-accent/50 dark:border-white/20">
                {dict.horoscopeReport.printReport}
              </button>
              <button
                type="button"
                onClick={shareReport}
                disabled={sharing}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {sharing ? dict.horoscopeReport.sharingReportImage : dict.horoscopeReport.shareReportImage}
              </button>
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold hover:border-accent/50 disabled:opacity-50 dark:border-white/20"
              >
                {justSaved ? dict.horoscopeReport.profileSaved : dict.horoscopeReport.saveProfile}
              </button>
              <button type="button" onClick={() => openTool("/birth-chart")} className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:border-accent/50 dark:border-white/20">
                {dict.horoscopeReport.openBirthChart}
              </button>
              <button type="button" onClick={() => openTool("/dasha")} className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:border-accent/50 dark:border-white/20">
                {dict.horoscopeReport.openDasha}
              </button>
              <button type="button" onClick={() => openTool("/daily-guide")} className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:border-accent/50 dark:border-white/20">
                {dict.horoscopeReport.openDailyGuide}
              </button>
              <button type="button" onClick={() => openTool("/pancha-pakshi")} className="rounded-lg border border-black/10 px-4 py-2 text-sm hover:border-accent/50 dark:border-white/20">
                {dict.horoscopeReport.openPanchaPakshi}
              </button>
            </div>
            {shareError && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{dict.horoscopeReport.shareFailed}</p>}
            <p className="mt-3 text-xs leading-relaxed opacity-70">{dict.horoscopeReport.privacyNote}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <ReportCard title={dict.horoscopeReport.derivedIdentityTitle} testId="horoscope-report-identity">
              <p className="text-lg font-semibold">{report.nakshatra}</p>
              <p className="text-sm opacity-75">
                {dict.panchanga.pada} {result.identity.nakshatra.pada}
              </p>
            </ReportCard>
            <ReportCard title={dict.ui.paksha}>
              <p className="text-lg font-semibold">{report.paksha}</p>
            </ReportCard>
            <ReportCard title={dict.birthNakshatra.moonRashi}>
              <p className="text-lg font-semibold">{report.moonRashi}</p>
            </ReportCard>
            <ReportCard title={dict.ui.birthBird}>
              <p className="flex items-center gap-2 text-lg font-semibold">
                {BirdIcon && <BirdIcon className="text-2xl" />}
                {report.bird}
              </p>
            </ReportCard>
          </div>

          <section className="rounded-xl border border-black/10 bg-white/30 p-4 dark:border-white/10 dark:bg-white/[.03]">
            <h2 className="text-sm font-semibold uppercase text-accent">{dict.horoscopeReport.summaryTitle}</h2>
            <p data-testid="horoscope-report-summary" className="mt-2 text-sm leading-relaxed">
              {report.identityLine}
            </p>
          </section>

          <section data-testid="horoscope-report-current-dasha" className="rounded-xl border border-black/10 bg-white/30 p-4 dark:border-white/10 dark:bg-white/[.03]">
            <h2 className="text-sm font-semibold uppercase text-accent">{dict.horoscopeReport.currentDashaTitle}</h2>
            {currentDasha ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DashaSummaryCard label={dict.horoscopeReport.currentMahadasha} value={translateEnum(dict, "horaPlanets", currentDasha.mahadasha.key)} range={`${currentDasha.mahadasha.start_date} - ${currentDasha.mahadasha.end_date}`} />
                <DashaSummaryCard label={dict.horoscopeReport.currentAntardasha} value={currentDasha.antardasha ? translateEnum(dict, "horaPlanets", currentDasha.antardasha.key) : dict.ui.none} range={currentDasha.antardasha ? `${currentDasha.antardasha.start_date} - ${currentDasha.antardasha.end_date}` : ""} />
              </div>
            ) : (
              <p className="mt-2 text-sm opacity-75">{dict.horoscopeReport.noCurrentDasha}</p>
            )}
          </section>

          <section data-testid="horoscope-report-chart" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase text-accent">{dict.horoscopeReport.chartTitle}</h2>
            <BirthChartChart chart={result.chart} />
          </section>

          <section data-testid="horoscope-report-dasha" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase text-accent">{dict.horoscopeReport.dashaTitle}</h2>
            <DashaTimeline periods={result.dasha.periods} />
          </section>
        </section>
      )}
    </div>
  );
}

function buildReportSummary(
  result: ReportResult,
  dict: ReturnType<typeof import("@/lib/i18n").getDictionary>,
  locale: "en" | "si",
  currentDasha: CurrentDasha,
) {
  const nakshatra = nakshatraName(result.identity.nakshatra.index, locale);
  const paksha = translateEnum(dict, "paksha", result.identity.paksha);
  const moonRashi = translateEnum(dict, "rashis", result.identity.moon_rashi.key);
  const bird = translateEnum(dict, "birds", result.identity.birth_bird);
  return {
    nakshatra,
    paksha,
    moonRashi,
    bird,
    currentDasha,
    identityLine: replaceTokens(dict.horoscopeReport.identityLine, {
      nakshatra,
      pada: result.identity.nakshatra.pada,
      paksha,
      moonRashi,
      bird,
    }),
  };
}

function ReportCard({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="rounded-xl border border-black/10 bg-white/30 p-4 dark:border-white/10 dark:bg-white/[.03]">
      <h2 className="text-xs font-semibold uppercase opacity-70">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function DashaSummaryCard({ label, value, range }: { label: string; value: string; range: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white/30 p-3 dark:border-white/10 dark:bg-white/[.03]">
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {range && <p className="mt-1 text-xs tabular-nums opacity-70">{range}</p>}
    </div>
  );
}

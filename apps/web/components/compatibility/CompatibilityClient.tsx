"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchCompatibility,
  type BirdId,
  type CompatibilityResponse,
  type RelationId,
} from "@/lib/api-client";
import { translateEnum } from "@/lib/i18n";
import { useLocale } from "@/lib/locale-context";
import { BIRD_ICONS } from "@/components/icons/birds";

const BIRDS: BirdId[] = ["vulture", "owl", "crow", "cock", "peacock"];
const DEFAULT_A: BirdId = "vulture";
const DEFAULT_B: BirdId = "peacock";

const RELATION_TONE: Record<RelationId, string> = {
  friend: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  same: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  enemy: "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200",
};

export function CompatibilityClient() {
  const { dict } = useLocale();
  const [birdA, setBirdA] = useState<BirdId>(DEFAULT_A);
  const [birdB, setBirdB] = useState<BirdId>(DEFAULT_B);
  const [data, setData] = useState<CompatibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const run = useCallback(
    async (nextA: BirdId, nextB: BirdId) => {
      const currentRequest = requestId.current + 1;
      requestId.current = currentRequest;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchCompatibility({ bird_a: nextA, bird_b: nextB });
        if (requestId.current === currentRequest) setData(result);
      } catch {
        if (requestId.current === currentRequest) {
          setError(dict.ui.errorTitle);
        }
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    },
    [dict.ui.errorTitle],
  );

  useEffect(() => {
    // Zero-click first result, matching the other tool screens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(DEFAULT_A, DEFAULT_B);
  }, [run]);

  const selectA = useCallback(
    (next: BirdId) => {
      setBirdA(next);
      void run(next, birdB);
    },
    [birdB, run],
  );

  const selectB = useCallback(
    (next: BirdId) => {
      setBirdB(next);
      void run(birdA, next);
    },
    [birdA, run],
  );

  const pairLabel = data
    ? `${translateEnum(dict, "birds", data.bird_a)} + ${translateEnum(dict, "birds", data.bird_b)}`
    : `${translateEnum(dict, "birds", birdA)} + ${translateEnum(dict, "birds", birdB)}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{dict.compatibility.title}</h1>
          <p className="mt-1 max-w-2xl text-sm opacity-80">{dict.compatibility.description}</p>
        </div>
      </header>

      <section
        aria-label={dict.compatibility.birdToolTitle}
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <BirdSelector
            label={dict.compatibility.firstBird}
            value={birdA}
            onChange={selectA}
          />
          <BirdSelector
            label={dict.compatibility.secondBird}
            value={birdB}
            onChange={selectB}
          />
        </div>

        <section
          data-testid="compatibility-result"
          aria-busy={loading}
          className="rounded-lg border border-black/10 bg-white/35 p-4 shadow-sm dark:border-white/10 dark:bg-white/[.03]"
        >
          <h2 className="text-sm font-semibold uppercase">{dict.compatibility.result}</h2>
          <p className="mt-2 text-sm opacity-75">{pairLabel}</p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
              <p>{dict.ui.errorTitle}</p>
              <button
                type="button"
                onClick={() => run(birdA, birdB)}
                className="mt-2 rounded-lg border border-black/10 px-3 py-1.5 dark:border-white/20"
              >
                {dict.ui.retry}
              </button>
            </div>
          )}

          {loading && !data && !error && (
            <div
              role="status"
              className="mt-4 h-28 rounded-lg border border-black/10 motion-safe:animate-pulse dark:border-white/10"
            >
              <span className="sr-only">{dict.ui.loading}</span>
            </div>
          )}

          {data && !error && (
            <div className="mt-4">
              <p
                className={`inline-flex rounded-full border px-3 py-1 text-lg font-semibold ${RELATION_TONE[data.relation]}`}
              >
                {translateEnum(dict, "relations", data.relation)}
              </p>
              <p className="mt-3 text-sm opacity-80">
                {dict.compatibility.sampleSize}: {data.sample_size}
              </p>
              {data.context_dependent && (
                <p
                  data-testid="compatibility-context-dependent"
                  className="mt-3 rounded-lg border border-sky-500/40 bg-sky-500/10 p-3 text-sm"
                >
                  {dict.compatibility.contextDependent}
                </p>
              )}
              <div
                data-testid="compatibility-variants"
                className="mt-4 overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_6rem] bg-black/5 px-3 py-2 text-xs font-semibold uppercase dark:bg-white/10">
                  <span>{dict.ui.relation}</span>
                  <span className="text-right">{dict.compatibility.sourceRows}</span>
                </div>
                {data.variants.map((variant) => (
                  <div
                    key={variant.relation}
                    className="grid grid-cols-[minmax(0,1fr)_6rem] border-t border-black/10 px-3 py-2 text-sm dark:border-white/10"
                  >
                    <span>{translateEnum(dict, "relations", variant.relation)}</span>
                    <span className="text-right tabular-nums">{variant.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </section>

      <p className="rounded-lg border border-black/10 bg-white/25 p-4 text-sm opacity-80 dark:border-white/10 dark:bg-white/[.03]">
        {dict.compatibility.note}
      </p>
    </div>
  );
}

function BirdSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BirdId;
  onChange: (bird: BirdId) => void;
}) {
  const { dict } = useLocale();

  return (
    <fieldset className="rounded-lg border border-black/10 bg-white/30 p-4 dark:border-white/10 dark:bg-white/[.03]">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <div className="mt-3 grid auto-rows-fr grid-cols-2 gap-2 min-[420px]:grid-cols-3 md:grid-cols-2 xl:grid-cols-3">
        {BIRDS.map((bird) => {
          const Icon = BIRD_ICONS[bird];
          const birdLabel = translateEnum(dict, "birds", bird);
          const selected = bird === value;
          return (
            <button
              key={bird}
              type="button"
              aria-pressed={selected}
              aria-label={`${label}: ${birdLabel}`}
              onClick={() => onChange(bird)}
              className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center text-sm leading-tight transition ${
                selected
                  ? "border-accent bg-accent/10 text-accent shadow-sm"
                  : "border-black/10 hover:border-accent/50 dark:border-white/10"
              }`}
            >
              <Icon className="text-3xl sm:text-4xl" />
              <span className="max-w-full">{birdLabel}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

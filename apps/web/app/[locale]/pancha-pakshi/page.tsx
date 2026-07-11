"use client";

import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { resolveKey } from "@/lib/i18n";
import { features } from "@/lib/feature-registry";

type Method = "birth_datetime" | "nakshatra_paksha" | "bird";

export default function PanchaPakshiPage() {
  const { dict } = useLocale();
  const [method, setMethod] = useState<Method>("bird");
  const feature = features.find((f) => f.id === "pancha-pakshi")!;

  const tabs: { id: Method; label: string }[] = [
    { id: "birth_datetime", label: dict.ui.methodBirthDetails },
    { id: "nakshatra_paksha", label: dict.ui.methodKnownNakshatra },
    { id: "bird", label: dict.ui.methodDirectBird },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{resolveKey(dict, feature.titleKey)}</h1>
        <p className="mt-1 opacity-80">{resolveKey(dict, feature.descriptionKey)}</p>
      </header>

      <div role="tablist" aria-label={dict.ui.birthDetails} className="flex gap-2 border-b border-black/10 dark:border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={method === tab.id}
            onClick={() => setMethod(tab.id)}
            className={`px-4 py-2 text-sm ${
              method === tab.id
                ? "border-b-2 border-accent font-semibold text-accent"
                : "opacity-70 hover:opacity-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section role="tabpanel" className="rounded-xl border border-black/10 p-6 dark:border-white/10">
        {method === "birth_datetime" && <BirthDetailsFormPlaceholder />}
        {method === "nakshatra_paksha" && <NakshatraPakshaFormPlaceholder />}
        {method === "bird" && <BirdSelectionFormPlaceholder />}
      </section>
    </div>
  );
}

// Placeholder panels — the interactive forms (LocationPicker, live schedule,
// countdown, timeline) are implemented in a follow-up pass; this establishes
// the page structure and tab wiring they'll slot into.
function BirthDetailsFormPlaceholder() {
  const { dict } = useLocale();
  return (
    <div className="opacity-70">
      {dict.ui.birthDate} / {dict.ui.birthTime} / {dict.ui.location}
    </div>
  );
}

function NakshatraPakshaFormPlaceholder() {
  const { dict } = useLocale();
  return (
    <div className="opacity-70">
      {dict.ui.birthNakshatra} / {dict.enums.paksha.waxing} / {dict.enums.paksha.waning}
    </div>
  );
}

function BirdSelectionFormPlaceholder() {
  const { dict } = useLocale();
  const birds = Object.keys(dict.enums.birds) as (keyof typeof dict.enums.birds)[];
  return (
    <div className="flex flex-wrap gap-3 opacity-70">
      {birds.map((b) => (
        <span key={b} className="rounded-full border border-black/10 px-3 py-1 text-sm dark:border-white/20">
          {dict.enums.birds[b]}
        </span>
      ))}
    </div>
  );
}

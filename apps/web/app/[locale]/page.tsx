"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { enabledFeatures } from "@/lib/feature-registry";
import { resolveKey } from "@/lib/i18n";

export default function LandingPage() {
  const { locale, dict } = useLocale();
  const features = enabledFeatures();

  return (
    <div className="flex flex-col gap-10">
      <section className="text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{dict.platform.name}</h1>
        <p className="mt-3 text-lg opacity-80">{dict.platform.tagline}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Link
            key={f.id}
            href={`/${locale}${f.route}`}
            className="rounded-xl border border-black/10 p-6 shadow-sm transition hover:shadow-md dark:border-white/10"
          >
            <h2 className="text-xl font-semibold text-accent">{resolveKey(dict, f.titleKey)}</h2>
            <p className="mt-2 text-sm opacity-80">{resolveKey(dict, f.descriptionKey)}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border border-black/10 p-4 text-sm opacity-80 dark:border-white/10">
        <p>{dict.disclaimer.text}</p>
        <Link href={`/${locale}/disclaimer`} className="mt-1 inline-block underline">
          {dict.nav.disclaimer}
        </Link>
      </section>

      <section className="flex flex-wrap gap-4 text-sm">
        <Link href={`/${locale}/methodology`} className="underline">
          {dict.nav.methodology}
        </Link>
        <Link href={`/${locale}/licensing`} className="underline">
          {dict.nav.licensing}
        </Link>
      </section>
    </div>
  );
}

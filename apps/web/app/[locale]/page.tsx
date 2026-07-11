import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, resolveKey } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";
import { enabledFeatures } from "@/lib/feature-registry";
import { PUBLIC_BASE_URL, PUBLIC_REPOSITORY_URL } from "@/lib/site-config";
import { BIRD_ICONS } from "@/components/icons/birds";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "landing", "");
}

const BIRD_ORDER = ["vulture", "owl", "crow", "cock", "peacock"] as const;

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const features = enabledFeatures();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: dict.platform.name,
        url: PUBLIC_BASE_URL,
        inLanguage: ["en", "si"],
      },
      {
        "@type": "WebApplication",
        name: dict.metadata.panchaPakshi.title,
        url: `${PUBLIC_BASE_URL}/${locale}/pancha-pakshi`,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: dict.metadata.panchaPakshi.description,
        license: `${PUBLIC_REPOSITORY_URL}/blob/main/LICENSE`,
      },
    ],
  };

  return (
    <div className="flex flex-col gap-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="hero-dawn relative overflow-hidden rounded-3xl px-6 py-16 text-center">
        <h1 className="relative text-3xl font-bold text-white drop-shadow-sm sm:text-4xl">
          {dict.platform.name}
        </h1>
        <p className="relative mt-3 text-lg text-white/90">{dict.platform.tagline}</p>
        <div
          aria-hidden
          className="relative mt-6 flex items-center justify-center gap-4 text-2xl text-white/80"
        >
          {BIRD_ORDER.map((bird) => {
            const Icon = BIRD_ICONS[bird];
            return <Icon key={bird} />;
          })}
        </div>
      </section>

      <section aria-label={dict.ui.availableTools} className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Link
            key={f.id}
            href={`/${locale}${f.route}`}
            className="group rounded-xl border border-black/10 p-6 shadow-sm transition hover:border-accent/50 hover:shadow-md motion-safe:hover:-translate-y-0.5 dark:border-white/10"
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

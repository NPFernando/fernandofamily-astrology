import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, resolveKey } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";
import { enabledFeatures } from "@/lib/feature-registry";
import { PUBLIC_BASE_URL, PUBLIC_REPOSITORY_URL } from "@/lib/site-config";
import { BIRD_ICONS } from "@/components/icons/birds";
import { CockIcon, PeacockIcon } from "@/components/icons/birds";
import { SunIcon } from "@/components/icons/sun";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "landing", "");
}

const BIRD_ORDER = ["vulture", "owl", "crow", "cock", "peacock"] as const;

// The registry's `icon` field resolved to a renderable component; new tools
// register their glyph here alongside their registry entry.
const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  peacock: PeacockIcon,
  sun: SunIcon,
  cock: CockIcon,
};

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
        name: dict.metadata.panchanga.title,
        url: `${PUBLIC_BASE_URL}/${locale}/panchanga`,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: dict.metadata.panchanga.description,
        license: `${PUBLIC_REPOSITORY_URL}/blob/main/LICENSE`,
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
      {
        "@type": "WebApplication",
        name: dict.metadata.compatibility.title,
        url: `${PUBLIC_BASE_URL}/${locale}/compatibility`,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: dict.metadata.compatibility.description,
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
          className="relative mt-7 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
        >
          {BIRD_ORDER.map((bird) => {
            const Icon = BIRD_ICONS[bird];
            return (
              <span
                key={bird}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-sm sm:h-14 sm:w-14"
              >
                <Icon className="text-2xl sm:text-3xl" />
              </span>
            );
          })}
        </div>
      </section>

      <section aria-label={dict.ui.availableTools} className="grid auto-rows-fr gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Link
            key={f.id}
            href={`/${locale}${f.route}`}
            className="group flex h-full flex-col rounded-lg border border-black/10 bg-white/30 p-5 shadow-sm transition hover:border-accent/50 hover:shadow-md motion-safe:hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[.03]"
          >
            <h2 className="flex items-center gap-3 text-lg font-semibold leading-snug text-accent sm:text-xl">
              {(() => {
                const Icon = FEATURE_ICONS[f.icon];
                return Icon ? <Icon className="shrink-0 text-2xl" /> : null;
              })()}
              {resolveKey(dict, f.titleKey)}
            </h2>
            <p className="mt-3 text-sm leading-relaxed opacity-80">{resolveKey(dict, f.descriptionKey)}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-black/10 bg-white/25 p-4 text-sm opacity-80 dark:border-white/10 dark:bg-white/[.03]">
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

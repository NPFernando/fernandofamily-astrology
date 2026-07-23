import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDictionary, resolveKey } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";
import { enabledFeatures } from "@/lib/feature-registry";
import { PUBLIC_BASE_URL, PUBLIC_REPOSITORY_URL } from "@/lib/site-config";
import { BIRD_ICONS } from "@/components/icons/birds";
import { FeatureIcon } from "@/components/icons/features";
import { FEATURE_POSTERS, LANDING_POSTER, isFeatureVisualId } from "@/lib/feature-assets";

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
      ...features.map((feature) => ({
        "@type": "WebApplication",
        name: resolveKey(dict, feature.titleKey),
        url: `${PUBLIC_BASE_URL}/${locale}${feature.route}`,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        description: resolveKey(dict, feature.descriptionKey),
        license: `${PUBLIC_REPOSITORY_URL}/blob/main/LICENSE`,
      })),
    ],
  };

  return (
    <div className="flex flex-col gap-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative min-h-[23rem] overflow-hidden rounded-2xl px-6 py-16 text-center sm:min-h-[28rem] sm:px-10 lg:text-left">
        <Image
          src={LANDING_POSTER}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 1024px, 100vw"
          className="object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/42 to-black/10" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="relative max-w-2xl">
          <h1 className="text-3xl font-bold text-white drop-shadow-sm sm:text-5xl">
            {dict.platform.name}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/90 sm:text-xl">{dict.platform.tagline}</p>
        </div>
        <div
          aria-hidden
          className="relative mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 lg:justify-start"
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
        {features.map((f) => {
          const visual = isFeatureVisualId(f.icon) ? f.icon : null;
          return (
            <Link
              key={f.id}
              href={`/${locale}${f.route}`}
              className="group flex h-full flex-col overflow-hidden rounded-lg border border-black/10 bg-white/30 shadow-sm transition hover:border-accent/50 hover:shadow-md motion-safe:hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[.03]"
            >
              {visual && (
                <div className="relative aspect-[16/7] overflow-hidden bg-black/10">
                  <Image
                    src={FEATURE_POSTERS[visual]}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-300 group-hover:scale-[1.025]"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="flex items-center gap-3 text-lg font-semibold leading-snug text-accent sm:text-xl">
                  {visual && <FeatureIcon feature={visual} className="shrink-0 text-2xl" />}
                  {resolveKey(dict, f.titleKey)}
                </h2>
                <p className="mt-3 text-sm leading-relaxed opacity-80">{resolveKey(dict, f.descriptionKey)}</p>
              </div>
            </Link>
          );
        })}
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

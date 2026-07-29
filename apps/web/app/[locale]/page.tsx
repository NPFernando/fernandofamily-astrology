import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getDictionary, resolveKey } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";
import { enabledFeatures } from "@/lib/feature-registry";
import { PUBLIC_BASE_URL, PUBLIC_REPOSITORY_URL } from "@/lib/site-config";
import { BIRD_ICONS } from "@/components/icons/birds";
import { FeatureIcon } from "@/components/icons/features";
import { PosterImage } from "@/components/PosterImage";
import { DeferredPoster } from "@/components/DeferredPoster";
import { FEATURE_POSTERS, FEATURE_POSTER_AVIFS, FEATURE_POSTER_FALLBACKS, LANDING_POSTER, LANDING_POSTER_AVIF, LANDING_POSTER_FALLBACK, isFeatureVisualId, posterSrcSet } from "@/lib/feature-assets";
import { groupedFeatures } from "@/lib/feature-groups";
import { HeritageMark } from "@/components/icons/heritage-mark";

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
  const lowData = (await cookies()).get("ff_low_data")?.value === "1";
  const dict = getDictionary(locale);
  const features = enabledFeatures();
  const groups = groupedFeatures(features);
  const featured = features.find((feature) => feature.id === "daily-guide") ?? features[0];
  const groupLabel = (id: string) => {
    if (id === "today") return dict.ui.todayTools;
    if (id === "birth") return dict.ui.birthTools;
    return dict.ui.familyTools;
  };

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

      <section className="hero-dawn relative min-h-[24rem] overflow-hidden rounded-2xl border border-amber-200/30 px-6 py-16 text-center shadow-xl shadow-amber-950/10 sm:min-h-[29rem] sm:px-10 lg:text-left">
        {!lowData && (
          <PosterImage
            avifSrcSet={posterSrcSet(LANDING_POSTER_AVIF)}
            webpSrcSet={posterSrcSet(LANDING_POSTER)}
            fallbackSrcSet={posterSrcSet(LANDING_POSTER_FALLBACK)}
            sizes="(max-width: 767px) 100vw, 1024px"
            avifSrc={LANDING_POSTER_AVIF}
            webpSrc={LANDING_POSTER}
            fallbackSrc={LANDING_POSTER_FALLBACK}
            alt=""
            aria-hidden
            fetchPriority="high"
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/42 to-black/10" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />
        <div className="relative max-w-2xl">
          <div className="mb-4 flex items-center justify-center gap-2 text-amber-100/90 lg:justify-start">
            <HeritageMark className="h-9 w-9" />
            <span className="text-sm font-semibold tracking-[0.16em] uppercase">{dict.ui.heritageDescriptor}</span>
          </div>
          <h1 className="heritage-display text-4xl font-bold text-white drop-shadow-sm sm:text-6xl">
            {dict.platform.name}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/90 sm:text-xl">{dict.platform.tagline}</p>
        </div>
        {!lowData && (
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
                  <Icon className="text-2xl sm:text-3xl" loading="eager" fetchPriority="high" />
                </span>
              );
            })}
          </div>
        )}
      </section>

      {featured && (() => {
        const visual = isFeatureVisualId(featured.icon) ? featured.icon : null;
        return (
          <section aria-label={dict.ui.startToday} className="heritage-card overflow-hidden rounded-2xl border">
            <Link href={`/${locale}${featured.route}`} className="group grid min-h-60 md:grid-cols-[1.1fr_0.9fr]">
              <div className="relative order-2 min-h-52 overflow-hidden md:order-1">
                {visual && !lowData && <PosterImage avifSrcSet={posterSrcSet(FEATURE_POSTER_AVIFS[visual])} webpSrcSet={posterSrcSet(FEATURE_POSTERS[visual])} fallbackSrcSet={posterSrcSet(FEATURE_POSTER_FALLBACKS[visual])} sizes="(max-width: 767px) 100vw, 44vw" avifSrc={FEATURE_POSTER_AVIFS[visual]} webpSrc={FEATURE_POSTERS[visual]} fallbackSrc={FEATURE_POSTER_FALLBACKS[visual]} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]" />}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-transparent to-background/25" />
              </div>
              <div className="order-1 flex flex-col justify-center p-7 md:order-2 md:p-9">
                <p className="text-xs font-bold tracking-[0.16em] text-accent uppercase">{dict.ui.startToday}</p>
                <h2 className="heritage-display mt-2 flex items-center gap-3 text-3xl font-semibold text-foreground">
                  {visual && <FeatureIcon feature={visual} className="shrink-0 text-4xl" />}
                  {resolveKey(dict, featured.titleKey)}
                </h2>
                <p className="mt-3 leading-relaxed opacity-80">{resolveKey(dict, featured.descriptionKey)}</p>
                <span className="mt-5 text-sm font-semibold text-accent">{dict.ui.exploreTools} →</span>
              </div>
            </Link>
          </section>
        );
      })()}

      {groups.map((group) => (
        <section key={group.id} aria-label={groupLabel(group.id)}>
          <div className="mb-4 flex items-center gap-3">
            <span aria-hidden className="heritage-ornament h-8 w-8 rounded-full border border-accent/25" />
            <h2 className="heritage-display text-2xl font-semibold">{groupLabel(group.id)}</h2>
          </div>
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2">
            {group.features.filter((f) => f.id !== featured?.id).map((f) => {
          const visual = isFeatureVisualId(f.icon) ? f.icon : null;
          return (
            <div
              key={f.id}
              className="heritage-card group flex h-full flex-col overflow-hidden rounded-xl border transition hover:border-accent/60 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
            >
              {visual && !lowData && (
                <div className="relative aspect-[16/7] overflow-hidden bg-black/10">
                  <DeferredPoster
                    avifSrcSet={posterSrcSet(FEATURE_POSTER_AVIFS[visual])}
                    webpSrcSet={posterSrcSet(FEATURE_POSTERS[visual])}
                    fallbackSrcSet={posterSrcSet(FEATURE_POSTER_FALLBACKS[visual])}
                    sizes="(max-width: 639px) calc(100vw - 2rem), 50vw"
                    avifSrc={FEATURE_POSTER_AVIFS[visual]}
                    webpSrc={FEATURE_POSTERS[visual]}
                    fallbackSrc={FEATURE_POSTER_FALLBACKS[visual]}
                    imageClassName="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
                  />
                </div>
              )}
              <Link href={`/${locale}${f.route}`} className="flex flex-1 flex-col p-5">
                <h2 className="flex items-center gap-3 text-lg font-semibold leading-snug text-accent sm:text-xl">
                  {visual && <FeatureIcon feature={visual} className="shrink-0 text-2xl" />}
                  {resolveKey(dict, f.titleKey)}
                </h2>
                <p className="mt-3 text-sm leading-relaxed opacity-80">{resolveKey(dict, f.descriptionKey)}</p>
              </Link>
            </div>
          );
            })}
          </div>
        </section>
      ))}

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

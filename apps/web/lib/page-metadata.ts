import type { Metadata } from "next";
import { DEFAULT_LOCALE, getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { DEFAULT_OG_IMAGE, FEATURE_OG_IMAGES, featureVisualFromPath } from "@/lib/feature-assets";

type Dict = ReturnType<typeof getDictionary>;
type MetadataPageKey = keyof Dict["metadata"];

export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

// Shared generateMetadata body for locale-scoped pages: localized title +
// description from the dictionary's metadata section, plus canonical/hreflang
// for the page path ("" for the landing page, "/pancha-pakshi", ...).
export async function localizedPageMetadata(
  params: Promise<{ locale: string }>,
  page: MetadataPageKey,
  path: string,
): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const entry = dict.metadata[page] as { title?: string; description: string };
  const feature = featureVisualFromPath(path);
  const image = feature ? FEATURE_OG_IMAGES[feature] : DEFAULT_OG_IMAGE;
  return {
    ...(entry.title ? { title: entry.title } : {}),
    description: entry.description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { en: `/en${path}`, si: `/si${path}` },
    },
    openGraph: {
      ...(entry.title ? { title: entry.title } : {}),
      description: entry.description,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [image],
    },
  };
}

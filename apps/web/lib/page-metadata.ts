import type { Metadata } from "next";
import { DEFAULT_LOCALE, getDictionary, isLocale, type Locale } from "@/lib/i18n";

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
  return {
    ...(entry.title ? { title: entry.title } : {}),
    description: entry.description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { en: `/en${path}`, si: `/si${path}` },
    },
  };
}

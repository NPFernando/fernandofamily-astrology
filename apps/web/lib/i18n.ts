import en from "@/locales/en.json";
import si from "@/locales/si.json";
import nakshatras from "@/locales/nakshatras.json";

export const SUPPORTED_LOCALES = ["en", "si"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "si";

export function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

const dictionaries: Record<Locale, typeof en> = { en, si };

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export type NakshatraEntry = { id: number; key: string; en: string; si: string };
export const NAKSHATRAS: NakshatraEntry[] = nakshatras;

export function nakshatraName(id: number, locale: Locale): string {
  const entry = NAKSHATRAS.find((n) => n.id === id);
  if (!entry) return String(id);
  return locale === "si" ? entry.si : entry.en;
}

// Translate a stable API enum value (e.g. "vulture", "very_bad") through the
// active locale's lookup table. Falls back to the raw value if a translation
// is ever missing, rather than throwing — a missing label should degrade
// gracefully, not break the page.
export function translateEnum(
  dict: ReturnType<typeof getDictionary>,
  group: keyof typeof en.enums,
  value: string,
): string {
  const table = dict.enums[group] as Record<string, string>;
  return table[value] ?? value;
}

// Resolves a dotted key path (e.g. "features.panchaPakshi.title") against the
// dictionary, for cases like the feature registry where the key itself is
// data-driven rather than known statically at the call site.
export function resolveKey(dict: ReturnType<typeof getDictionary>, keyPath: string): string {
  const parts = keyPath.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = dict;
  for (const part of parts) {
    if (node == null) break;
    node = node[part];
  }
  return typeof node === "string" ? node : keyPath;
}

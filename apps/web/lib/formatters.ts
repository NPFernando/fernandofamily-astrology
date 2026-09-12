import type { Locale } from "@/lib/i18n";

export function localeTag(locale: Locale | string): "si-LK" | "en-US" {
  return locale === "si" ? "si-LK" : "en-US";
}

export function formatLocalDate(value: string | Date, locale: Locale | string, options: Intl.DateTimeFormatOptions = {}): string {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString(localeTag(locale), options);
}

export function formatLocalTime(value: string | Date, locale: Locale | string, options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }): string {
  return new Date(value).toLocaleTimeString(localeTag(locale), options);
}

export function formatLocalDateTime(value: string | Date, locale: Locale | string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(value).toLocaleString(localeTag(locale), options);
}

export function formatLocalNumber(value: number, locale: Locale | string): string {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}

export function formatLocalWeekday(value: string | Date, locale: Locale | string, width: "long" | "short" = "short"): string {
  return formatLocalDate(value, locale, { weekday: width });
}

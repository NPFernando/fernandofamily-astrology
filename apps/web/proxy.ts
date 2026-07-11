import { NextRequest, NextResponse } from "next/server";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isLocale } from "@/lib/i18n";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocalePrefix = SUPPORTED_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocalePrefix) return NextResponse.next();

  const cookieLocale = request.cookies.get("ff_locale")?.value ?? "";
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};

import type { Metadata } from "next";
import { Inter, Noto_Sans_Sinhala } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { SUPPORTED_LOCALES, isLocale, getDictionary, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { PUBLIC_BASE_URL } from "@/lib/site-config";

const bodyFont = Inter({ variable: "--font-body", subsets: ["latin"] });
const sinhalaFont = Noto_Sans_Sinhala({ variable: "--font-sinhala", subsets: ["sinhala"] });

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "si";
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(PUBLIC_BASE_URL),
    title: dict.platform.name,
    description: dict.platform.tagline,
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", si: "/si" },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;

  return (
    <html lang={locale} className={`${bodyFont.variable} ${sinhalaFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <LocaleProvider locale={locale}>
            <Nav />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
            <Footer />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

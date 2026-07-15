import type { Metadata } from "next";
import { Inter, Noto_Sans_Sinhala } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import "../globals.css";
import { SUPPORTED_LOCALES, isLocale, getDictionary, type Locale } from "@/lib/i18n";
import { LocaleProvider } from "@/lib/locale-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { PUBLIC_BASE_URL } from "@/lib/site-config";

const bodyFont = Inter({ variable: "--font-body", subsets: ["latin"] });
const sinhalaFont = Noto_Sans_Sinhala({ variable: "--font-sinhala", subsets: ["sinhala"] });
const themeInitScript = `(function(){try{var k='ff_theme';var m=document.cookie.match(/(?:^|; )ff_theme=(dark|light)(?:;|$)/);var c=m&&m[1];var s=localStorage.getItem(k);var t=s||c||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark');document.cookie=k+'='+t+'; path=/; max-age=31536000; SameSite=Lax';}catch(e){}})();`;

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
    title: {
      default: dict.platform.name,
      template: `%s | ${dict.platform.name}`,
    },
    description: dict.platform.tagline,
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", si: "/si" },
    },
    icons: {
      icon: "/icons/app/icon-192.png",
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      title: dict.platform.name,
      statusBarStyle: "default",
    },
    openGraph: {
      siteName: dict.platform.name,
      type: "website",
      locale: locale === "si" ? "si_LK" : "en_US",
      images: [{ url: "/og/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/og/og-default.png"],
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
  const theme = (await cookies()).get("ff_theme")?.value;
  const themeClass = theme === "dark" ? " dark" : "";

  return (
    <html
      lang={locale}
      className={`${bodyFont.variable} ${sinhalaFont.variable} h-full antialiased${themeClass}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>
          <LocaleProvider locale={locale}>
            <ServiceWorkerRegister />
            <Nav />
            <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
            <Footer />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

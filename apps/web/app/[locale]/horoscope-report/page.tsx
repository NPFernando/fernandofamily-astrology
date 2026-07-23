import type { Metadata } from "next";
import { HoroscopeReportClient } from "@/components/horoscope-report/HoroscopeReportClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "horoscopeReport", "/horoscope-report");
}

export default function HoroscopeReportPage() {
  return <HoroscopeReportClient />;
}

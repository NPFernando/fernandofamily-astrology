import type { Metadata } from "next";
import { Suspense } from "react";
import { DailyGuideClient } from "@/components/daily-guide/DailyGuideClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "dailyGuide", "/daily-guide");
}

export default function DailyGuidePage() {
  return (
    <Suspense>
      <DailyGuideClient />
    </Suspense>
  );
}

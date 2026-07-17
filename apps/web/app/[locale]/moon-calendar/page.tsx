import type { Metadata } from "next";
import { Suspense } from "react";
import { localizedPageMetadata } from "@/lib/page-metadata";
import { MoonCalendarClient } from "@/components/moon-calendar/MoonCalendarClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "moonCalendar", "/moon-calendar");
}

export default function MoonCalendarPage() {
  return (
    <Suspense>
      <MoonCalendarClient />
    </Suspense>
  );
}

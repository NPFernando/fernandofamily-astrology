import type { Metadata } from "next";
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
  return <MoonCalendarClient />;
}

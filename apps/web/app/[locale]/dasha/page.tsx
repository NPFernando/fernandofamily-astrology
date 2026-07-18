import type { Metadata } from "next";
import { DashaClient } from "@/components/dasha/DashaClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "dasha", "/dasha");
}

export default function DashaPage() {
  return <DashaClient />;
}

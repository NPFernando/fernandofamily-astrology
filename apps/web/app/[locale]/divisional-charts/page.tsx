import type { Metadata } from "next";
import { DivisionalChartsClient } from "@/components/divisional-charts/DivisionalChartsClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "divisionalCharts", "/divisional-charts");
}

export default function DivisionalChartsPage() {
  return <DivisionalChartsClient />;
}

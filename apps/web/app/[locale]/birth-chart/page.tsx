import type { Metadata } from "next";
import { BirthChartClient } from "@/components/birth-chart/BirthChartClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "birthChart", "/birth-chart");
}

export default function BirthChartPage() {
  return <BirthChartClient />;
}

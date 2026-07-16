import type { Metadata } from "next";
import { BirthNakshatraClient } from "@/components/birth-nakshatra/BirthNakshatraClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "birthNakshatra", "/birth-nakshatra");
}

export default function BirthNakshatraPage() {
  return <BirthNakshatraClient />;
}

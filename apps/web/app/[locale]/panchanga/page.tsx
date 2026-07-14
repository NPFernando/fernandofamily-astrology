import type { Metadata } from "next";
import { localizedPageMetadata } from "@/lib/page-metadata";
import { PanchangaClient } from "@/components/panchanga/PanchangaClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "panchanga", "/panchanga");
}

export default function PanchangaPage() {
  return <PanchangaClient />;
}

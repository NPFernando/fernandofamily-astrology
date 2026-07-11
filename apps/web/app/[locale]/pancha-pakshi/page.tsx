import type { Metadata } from "next";
import { localizedPageMetadata } from "@/lib/page-metadata";
import { PanchaPakshiClient } from "@/components/pancha-pakshi/PanchaPakshiClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "panchaPakshi", "/pancha-pakshi");
}

export default function PanchaPakshiPage() {
  return <PanchaPakshiClient />;
}

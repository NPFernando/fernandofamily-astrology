import type { Metadata } from "next";
import { localizedPageMetadata } from "@/lib/page-metadata";
import { PanchaPakshiLiveView } from "@/components/pancha-pakshi/PanchaPakshiLiveView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "panchaPakshiLive", "/pancha-pakshi/live");
}

export default function PanchaPakshiLivePage() {
  return <PanchaPakshiLiveView />;
}

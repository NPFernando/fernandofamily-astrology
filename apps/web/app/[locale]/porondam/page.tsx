import type { Metadata } from "next";
import { PorondamClient } from "@/components/porondam/PorondamClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "porondam", "/porondam");
}

export default function PorondamPage() {
  return <PorondamClient />;
}

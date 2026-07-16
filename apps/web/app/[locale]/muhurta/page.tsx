import type { Metadata } from "next";
import { MuhurtaClient } from "@/components/muhurta/MuhurtaClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "muhurta", "/muhurta");
}

export default function MuhurtaPage() {
  return <MuhurtaClient />;
}

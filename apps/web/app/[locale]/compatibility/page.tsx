import type { Metadata } from "next";
import { CompatibilityClient } from "@/components/compatibility/CompatibilityClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "compatibility", "/compatibility");
}

export default function CompatibilityPage() {
  return <CompatibilityClient />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { FamilyAlmanacClient } from "@/components/family-almanac/FamilyAlmanacClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "familyAlmanac", "/family-almanac");
}

export default function FamilyAlmanacPage() {
  return (
    <Suspense>
      <FamilyAlmanacClient />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { PlannerClient } from "@/components/daily-guide/PlannerClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return localizedPageMetadata(params, "dailyGuide", "/daily-guide/planner");
}

export default function PlannerPage() {
  return <PlannerClient />;
}

import type { Metadata } from "next";
import { RoadmapFeedbackClient } from "@/components/RoadmapFeedbackClient";
import { localizedPageMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return localizedPageMetadata(params, "about", "/roadmap");
}

export default function RoadmapPage() { return <RoadmapFeedbackClient />; }

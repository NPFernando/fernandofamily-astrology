import type { Metadata } from "next";
import { AshtakavargaClient } from "@/components/ashtakavarga/AshtakavargaClient";
import { localizedPageMetadata } from "@/lib/page-metadata";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { return localizedPageMetadata(params, "ashtakavarga", "/ashtakavarga"); }
export default function AshtakavargaPage() { return <AshtakavargaClient />; }

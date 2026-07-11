import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "about", "/about");
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const dict = getDictionary(await resolveLocale(params));
  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-bold">{dict.pages.about.title}</h1>
      <p className="mt-4 leading-relaxed">{dict.pages.about.body}</p>
    </article>
  );
}

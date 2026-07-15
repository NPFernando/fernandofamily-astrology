import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";
import { PUBLIC_REPOSITORY_URL } from "@/lib/site-config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "methodology", "/methodology");
}

export default async function MethodologyPage({ params }: { params: Promise<{ locale: string }> }) {
  const dict = getDictionary(await resolveLocale(params));
  const m = dict.pages.methodology;
  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-bold">{m.title}</h1>
      <p className="mt-4 leading-relaxed">{m.sunriseDay}</p>
      <p className="mt-4 leading-relaxed">{m.birdMapping}</p>
      <p className="mt-4 leading-relaxed">{m.periods}</p>
      <p className="mt-4 leading-relaxed">{m.timezones}</p>
      <p className="mt-4 leading-relaxed">{m.limitations}</p>
      <h2 className="mt-8 text-xl font-bold">{m.panchangaHeading}</h2>
      <p className="mt-4 leading-relaxed">{m.panchangaAyanamsa}</p>
      <p className="mt-4 leading-relaxed">{m.panchangaPoyaRule}</p>
      <p className="mt-4 leading-relaxed">{m.panchangaDivergence}</p>
      <a
        href={`${PUBLIC_REPOSITORY_URL}/blob/main/docs/calculations`}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 inline-block underline"
      >
        {m.sourceLinkLabel}
      </a>
    </article>
  );
}

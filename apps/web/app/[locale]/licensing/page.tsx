import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";
import { PUBLIC_REPOSITORY_URL } from "@/lib/site-config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "licensing", "/licensing");
}

export default async function LicensingPage({ params }: { params: Promise<{ locale: string }> }) {
  const dict = getDictionary(await resolveLocale(params));
  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-bold">{dict.pages.licensing.title}</h1>
      <p className="mt-4 leading-relaxed">{dict.pages.licensing.body}</p>
      <dl className="mt-4 text-sm opacity-80">
        <dt className="font-semibold">{dict.pages.licensing.engineLabel}</dt>
        <dd>{dict.pages.licensing.engineValue}</dd>
      </dl>
      <a
        href={`${PUBLIC_REPOSITORY_URL}/blob/main/docs/licensing.md`}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 inline-block underline"
      >
        {dict.pages.licensing.repoLinkLabel}
      </a>
    </article>
  );
}

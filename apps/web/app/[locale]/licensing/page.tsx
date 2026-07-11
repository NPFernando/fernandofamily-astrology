"use client";

import { useLocale } from "@/lib/locale-context";
import { PUBLIC_REPOSITORY_URL } from "@/lib/site-config";

export default function LicensingPage() {
  const { dict } = useLocale();
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

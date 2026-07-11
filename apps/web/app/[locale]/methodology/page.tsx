"use client";

import { useLocale } from "@/lib/locale-context";
import { PUBLIC_REPOSITORY_URL } from "@/lib/site-config";

export default function MethodologyPage() {
  const { dict } = useLocale();
  const m = dict.pages.methodology;
  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-bold">{m.title}</h1>
      <p className="mt-4 leading-relaxed">{m.sunriseDay}</p>
      <p className="mt-4 leading-relaxed">{m.birdMapping}</p>
      <p className="mt-4 leading-relaxed">{m.periods}</p>
      <p className="mt-4 leading-relaxed">{m.timezones}</p>
      <p className="mt-4 leading-relaxed">{m.limitations}</p>
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

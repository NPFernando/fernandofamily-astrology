"use client";

import { useLocale } from "@/lib/locale-context";

export default function AboutPage() {
  const { dict } = useLocale();
  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-bold">{dict.pages.about.title}</h1>
      <p className="mt-4 leading-relaxed">{dict.pages.about.body}</p>
    </article>
  );
}

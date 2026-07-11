"use client";

import { useLocale } from "@/lib/locale-context";

export default function DisclaimerPage() {
  const { dict } = useLocale();
  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-bold">{dict.nav.disclaimer}</h1>
      <p className="mt-4 text-lg leading-relaxed">{dict.disclaimer.text}</p>
    </article>
  );
}

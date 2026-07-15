"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { PUBLIC_REPOSITORY_URL, DEPLOYED_COMMIT } from "@/lib/site-config";

export function Footer() {
  const { locale, dict } = useLocale();
  const shortCommit = DEPLOYED_COMMIT === "dev" ? "dev" : DEPLOYED_COMMIT.slice(0, 7);

  return (
    <footer data-app-shell className="mt-12 border-t border-black/10 px-4 py-8 text-sm dark:border-white/10">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <nav className="flex flex-wrap gap-4">
          <a href={PUBLIC_REPOSITORY_URL} target="_blank" rel="noreferrer noopener" className="hover:underline">
            {dict.nav.sourceCode}
          </a>
          <Link href={`/${locale}/licensing`} className="hover:underline">
            {dict.nav.licensing}
          </Link>
          <Link href={`/${locale}/methodology`} className="hover:underline">
            {dict.nav.methodology}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:underline">
            {dict.nav.privacy}
          </Link>
          <Link href={`/${locale}/disclaimer`} className="hover:underline">
            {dict.nav.disclaimer}
          </Link>
        </nav>
        <p className="text-xs opacity-60">
          {dict.platform.name} &middot; AGPL-3.0 &middot; build {shortCommit}
        </p>
      </div>
    </footer>
  );
}

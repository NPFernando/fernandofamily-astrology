"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";

export default function NotFound() {
  const { locale, dict } = useLocale();
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="mt-2 opacity-70">
        <Link href={`/${locale}`} className="underline">
          {dict.nav.home}
        </Link>
      </p>
    </div>
  );
}

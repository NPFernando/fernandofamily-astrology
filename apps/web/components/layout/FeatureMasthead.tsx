"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { enabledFeatures } from "@/lib/feature-registry";
import { FEATURE_POSTERS, isFeatureVisualId } from "@/lib/feature-assets";
import { useLocale } from "@/lib/locale-context";

export function FeatureMasthead() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const feature = enabledFeatures().find((entry) => pathname === `/${locale}${entry.route}`);

  if (!feature || !isFeatureVisualId(feature.icon)) return null;

  return (
    <div
      aria-hidden="true"
      className="mx-auto mt-4 w-full max-w-5xl px-4"
      data-testid="feature-masthead"
    >
      <div className="relative h-20 overflow-hidden rounded-xl border border-black/10 bg-slate-950 shadow-inner dark:border-white/10 sm:h-24">
        <Image
          alt=""
          className="object-cover opacity-80"
          fill
          priority
          sizes="(min-width: 1024px) 1024px, 100vw"
          src={FEATURE_POSTERS[feature.icon]}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/55 via-slate-950/20 to-slate-950/65" />
        <div className="absolute inset-0 ring-1 ring-inset ring-amber-300/15" />
      </div>
    </div>
  );
}

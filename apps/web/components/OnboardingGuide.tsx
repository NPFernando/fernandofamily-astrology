"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";

const DISMISS_KEY = "ff_onboarding_dismissed";

export function OnboardingGuide() {
  const { dict, locale } = useLocale(); const [dismissed, setDismissed] = useState(true);
  useEffect(() => setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1"), []);
  if (dismissed) return null;
  return <section className="heritage-card rounded-2xl border p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[0.16em] text-accent uppercase">{dict.ui.getStarted}</p><h2 className="heritage-display mt-1 text-2xl font-semibold">{dict.ui.onboardingTitle}</h2><p className="mt-2 max-w-3xl opacity-80">{dict.ui.onboardingDescription}</p></div><button type="button" onClick={() => { window.localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }} className="rounded-lg border px-3 py-1.5 text-sm">{dict.ui.notNow}</button></div><ol className="mt-5 grid gap-3 md:grid-cols-3"><li className="rounded-xl bg-accent/10 p-4"><strong>1. {dict.ui.onboardingStepOneTitle}</strong><p className="mt-1 text-sm opacity-80">{dict.ui.onboardingStepOneBody}</p></li><li className="rounded-xl bg-accent/10 p-4"><strong>2. {dict.ui.onboardingStepTwoTitle}</strong><p className="mt-1 text-sm opacity-80">{dict.ui.onboardingStepTwoBody}</p></li><li className="rounded-xl bg-accent/10 p-4"><strong>3. {dict.ui.onboardingStepThreeTitle}</strong><p className="mt-1 text-sm opacity-80">{dict.ui.onboardingStepThreeBody}</p></li></ol><Link href={`/${locale}/birth-nakshatra`} className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">{dict.ui.onboardingCta}</Link></section>;
}

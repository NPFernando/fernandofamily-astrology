"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { loadBirthCalculationHandoff } from "@/lib/birth-calculation-handoff";
import { saveReport } from "@/lib/saved-reports";

export function ReportWorkspaceActions({ reportPath }: { reportPath: string }) {
  const { dict, locale } = useLocale(); const router = useRouter(); const [saved, setSaved] = useState(false);
  const handoff = loadBirthCalculationHandoff();
  const links = [handoff?.chart && ["/birth-chart", dict.nav.birthChart], handoff?.dasha && ["/dasha", dict.nav.dasha], handoff?.divisional && ["/divisional-charts", dict.nav.divisionalCharts], handoff?.ashtakavarga && ["/ashtakavarga", dict.nav.ashtakavarga]].filter(Boolean) as [string, string][];
  return <div className="print:hidden flex flex-col gap-2"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { if (handoff) { saveReport(window.prompt(dict.ui.profileLabelPrompt) ?? "", handoff, reportPath); setSaved(true); } }} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold hover:border-accent/50 dark:border-white/20">{dict.ui.saveToMyReports}</button><button type="button" onClick={() => window.print()} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold hover:border-accent/50 dark:border-white/20">{dict.ui.print}</button><button type="button" onClick={() => router.push(`/${locale}/my-reports`)} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold hover:border-accent/50 dark:border-white/20">{dict.ui.myReports}</button></div>{saved && <p role="status" className="text-sm text-accent">{dict.ui.reportSaved}</p>}{links.length > 1 && <div className="rounded-lg bg-accent/10 px-3 py-2 text-sm"><span className="mr-2 font-semibold">{dict.ui.continueCalculation}</span>{links.filter(([path]) => path !== reportPath).map(([path, label]) => <button key={path} type="button" onClick={() => router.push(`/${locale}${path}`)} className="mr-2 underline underline-offset-2">{label}</button>)}</div>}</div>;
}

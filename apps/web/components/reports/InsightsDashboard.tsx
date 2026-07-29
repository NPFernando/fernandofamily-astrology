"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { listSavedReports, type SavedReport } from "@/lib/saved-reports";
import { translateEnum } from "@/lib/i18n";

export function InsightsDashboard() {
  const { dict, locale } = useLocale(); const [reports, setReports] = useState<SavedReport[]>([]); useEffect(() => setReports(listSavedReports()), []);
  const favourite = reports.find((report) => report.favorite) ?? reports[0]; const current = useMemo(() => { const today = new Date().toISOString().slice(0, 10); return favourite?.handoff.dasha?.periods.find((period) => period.start_date <= today && today < period.end_date) ?? null; }, [favourite]);
  return <div className="grid gap-4 lg:grid-cols-3"><section className="heritage-card rounded-2xl border p-5"><h2 className="font-semibold">{dict.ui.insightsRecentReports}</h2><p className="mt-2 text-3xl font-bold text-accent">{reports.length}</p><Link href={`/${locale}/my-reports`} className="mt-3 inline-block text-sm underline">{dict.ui.myReports}</Link></section><section className="heritage-card rounded-2xl border p-5"><h2 className="font-semibold">{dict.ui.insightsCurrentDasha}</h2>{current ? <p className="mt-3 text-lg text-accent">{translateEnum(dict, "horaPlanets", current.key)}</p> : <p className="mt-3 text-sm opacity-75">{dict.ui.insightsNoDasha}</p>}<Link href={`/${locale}/dasha`} className="mt-3 inline-block text-sm underline">{dict.nav.dasha}</Link></section><section className="heritage-card rounded-2xl border p-5"><h2 className="font-semibold">{dict.ui.insightsToday}</h2><p className="mt-3 text-sm opacity-75">{dict.ui.insightsTodayDescription}</p><div className="mt-3 flex flex-wrap gap-3"><Link href={`/${locale}/daily-guide`} className="text-sm underline">{dict.nav.dailyGuide}</Link><Link href={`/${locale}/pancha-pakshi`} className="text-sm underline">{dict.nav.panchaPakshi}</Link></div></section></div>;
}

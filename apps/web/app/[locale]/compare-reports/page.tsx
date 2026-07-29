import { ReportComparison } from "@/components/reports/ReportComparison";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/page-metadata";

export default async function CompareReportsPage({ params }: { params: Promise<{ locale: string }> }) { const dict = getDictionary(await resolveLocale(params)); return <div className="flex w-full flex-col gap-6"><header><h1 className="text-2xl font-bold">{dict.ui.compareReports}</h1><p className="mt-1 opacity-75">{dict.ui.deviceOnly}</p></header><ReportComparison /></div>; }

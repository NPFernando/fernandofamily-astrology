import { SavedReportsWorkspace } from "@/components/reports/SavedReportsWorkspace";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/page-metadata";
export default async function MyReportsPage({ params }: { params: Promise<{ locale: string }> }) { const dict = getDictionary(await resolveLocale(params)); return <div className="flex max-w-3xl flex-col gap-6"><header><h1 className="text-2xl font-bold">{dict.ui.myReports}</h1><p className="mt-1 opacity-75">{dict.ui.deviceOnly}</p></header><SavedReportsWorkspace /></div>; }

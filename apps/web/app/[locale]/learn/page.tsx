import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> { return localizedPageMetadata(params, "learn", "/learn"); }

export default async function LearnPage({ params }: { params: Promise<{ locale: string }> }) { const locale = await resolveLocale(params); const dict = getDictionary(locale); const learn = dict.pages.learn; return <article className="w-full max-w-4xl"><h1 className="text-2xl font-bold">{learn.title}</h1><p className="mt-4 text-lg leading-relaxed">{learn.intro}</p><div className="mt-6 grid gap-4 md:grid-cols-3">{[learn.readResults, learn.privacy, learn.tradition].map((item) => <section key={item.title} className="heritage-card rounded-xl border p-4"><h2 className="font-semibold text-accent">{item.title}</h2><p className="mt-2 text-sm leading-relaxed">{item.body}</p></section>)}</div><div className="mt-6 flex flex-wrap gap-4 text-sm"><Link href={`/${locale}/methodology`} className="underline">{dict.nav.methodology}</Link><Link href={`/${locale}/privacy`} className="underline">{dict.nav.privacy}</Link><Link href={`/${locale}/disclaimer`} className="underline">{dict.nav.disclaimer}</Link></div></article>; }

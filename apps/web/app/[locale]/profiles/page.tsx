import { ProfileManager } from "@/components/profiles/ProfileManager";
import { PrivateBirthVault } from "@/components/profiles/PrivateBirthVault";
import { getDictionary } from "@/lib/i18n";
import { resolveLocale } from "@/lib/page-metadata";

export default async function ProfilesPage({ params }: { params: Promise<{ locale: string }> }) { const dict = getDictionary(await resolveLocale(params)); return <div className="flex w-full flex-col gap-6"><header><h1 className="text-2xl font-bold">{dict.ui.savedProfiles}</h1><p className="mt-1 opacity-75">{dict.ui.profileManagerDescription}</p></header><PrivateBirthVault /><ProfileManager /></div>; }

"use client";

import { useEffect, useState } from "react";
import type { BirthCalculationInput } from "@/lib/birth-calculation-handoff";
import { listPrivateBirthProfiles, removePrivateBirthProfile, savePrivateBirthProfile, type PrivateBirthProfile } from "@/lib/private-birth-profiles";
import { useLocale } from "@/lib/locale-context";

export function PrivateBirthProfilePicker({ input, onSelect }: { input: BirthCalculationInput | null; onSelect: (input: BirthCalculationInput) => void }) {
  const { dict } = useLocale(); const [profiles, setProfiles] = useState<PrivateBirthProfile[]>([]); const refresh = () => setProfiles(listPrivateBirthProfiles()); useEffect(refresh, []);
  return <div className="rounded-xl border border-black/10 p-3 text-sm dark:border-white/10"><p className="font-semibold">{dict.ui.privateBirthProfiles}</p><p className="mt-1 text-xs opacity-70">{dict.ui.privateBirthProfilesNote}</p>{profiles.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{profiles.map((profile) => <span key={profile.id} className="inline-flex overflow-hidden rounded-lg border"><button type="button" onClick={() => onSelect(profile.input)} className="px-3 py-1.5 hover:bg-accent/10">{profile.label}</button><button type="button" aria-label={`${dict.ui.remove}: ${profile.label}`} onClick={() => { removePrivateBirthProfile(profile.id); refresh(); }} className="border-l px-2 opacity-70 hover:bg-red-500/10">×</button></span>)}</div>}{input && <button type="button" onClick={() => { const label = window.prompt(dict.ui.profileLabelPrompt); if (label !== null) { savePrivateBirthProfile(label, input); refresh(); } }} className="mt-3 rounded-lg border border-accent/40 px-3 py-1.5 font-semibold text-accent hover:bg-accent/10">{dict.ui.savePrivateBirthProfile}</button>}</div>;
}

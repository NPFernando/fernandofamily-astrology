"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { listProfiles, mergeLocalToServerOnce, removeProfile, updateProfile, type SavedProfile } from "@/lib/profiles";
import { useSessionProbe } from "@/lib/use-session-probe";

export function ProfileManager() {
  const { dict } = useLocale(); const probe = useSessionProbe(); const signedIn = Boolean(probe.user?.email); const [profiles, setProfiles] = useState<SavedProfile[]>([]); const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => setProfiles(await listProfiles(signedIn)), [signedIn]);
  useEffect(() => { if (!probe.loaded) return; void (async () => { if (signedIn) await mergeLocalToServerOnce(); await refresh(); })(); }, [probe.loaded, signedIn, refresh]);
  const rename = async (profile: SavedProfile) => { const label = window.prompt(dict.ui.profileLabelPrompt, profile.label)?.trim(); if (!label) return; await updateProfile(signedIn, profile.id, { ...profile, label }); await refresh(); setNotice(dict.ui.profileRenamed); };
  const remove = async (profile: SavedProfile) => { if (!window.confirm(profile.label)) return; await removeProfile(signedIn, profile.id); await refresh(); setNotice(dict.ui.profileDeleted); };
  return <section className="heritage-card rounded-2xl border p-4 shadow-sm sm:p-5"><p className="text-sm opacity-75">{dict.ui.profileManagerDescription}</p>{signedIn && <p className="mt-2 text-xs text-accent">{dict.ui.syncedToAccount}</p>}{notice && <p role="status" className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-sm">{notice}</p>}{profiles.length === 0 ? <p className="mt-4">{dict.ui.emptyProfiles}</p> : <div className="mt-4 grid gap-3">{profiles.map((profile) => <article key={profile.id} className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"><div><h2 className="font-semibold">{profile.label}</h2><p className="text-xs opacity-70">{profile.bird ? dict.ui.profileBirdDescription : dict.ui.profileDerivedDescription}</p></div><div className="flex gap-2"><button type="button" onClick={() => rename(profile)} className="rounded-lg border px-3 py-1.5 text-sm">{dict.ui.rename}</button><button type="button" onClick={() => remove(profile)} className="rounded-lg border px-3 py-1.5 text-sm">{dict.ui.remove}</button></div></article>)}</div>}</section>;
}

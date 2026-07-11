"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum, nakshatraName } from "@/lib/i18n";
import {
  listProfiles,
  addProfile,
  removeProfile,
  mergeLocalToServerOnce,
  type SavedProfile,
} from "@/lib/profiles";

// Renders the saved-profile chips and exposes a save affordance for the
// current result. Session state is probed the same way AccountMenu does —
// a 404 from the session endpoint simply means "anonymous, local-only".
export function SavedProfiles({
  onPick,
  saveCandidate,
}: {
  onPick: (profile: SavedProfile) => void;
  // The identity of the currently-displayed result, if any — offered as
  // "Save as profile". Never includes birth date/time/coordinates.
  saveCandidate: Omit<SavedProfile, "id" | "created_at" | "label"> | null;
}) {
  const { dict, locale } = useLocale();
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useCallback(async (isSignedIn: boolean) => {
    setProfiles(await listProfiles(isSignedIn));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let isSignedIn = false;
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          isSignedIn = Boolean(data?.user?.email);
        }
      } catch {
        // network hiccup -> stay local
      }
      if (cancelled) return;
      setSignedIn(isSignedIn);
      if (isSignedIn) await mergeLocalToServerOnce();
      if (!cancelled) await refresh(isSignedIn);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleSave() {
    if (!saveCandidate) return;
    const label = window.prompt(dict.ui.profileLabelPrompt)?.trim();
    if (!label) return;
    setSaving(true);
    try {
      await addProfile(signedIn, { ...saveCandidate, label });
      await refresh(signedIn);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    await removeProfile(signedIn, id);
    await refresh(signedIn);
  }

  function chipText(p: SavedProfile): string {
    if (p.bird) return `${p.label} · ${translateEnum(dict, "birds", p.bird)}`;
    if (p.nakshatra_index && p.paksha) {
      return `${p.label} · ${nakshatraName(p.nakshatra_index, locale)}`;
    }
    return p.label;
  }

  if (profiles.length === 0 && !saveCandidate) return null;

  return (
    <div className="flex flex-col gap-2">
      {profiles.length > 0 && (
        <>
          <span className="text-xs uppercase opacity-60">
            {dict.ui.savedProfiles}
            {signedIn && <span className="ml-2 normal-case opacity-70">({dict.ui.syncedToAccount})</span>}
          </span>
          <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-1 rounded-full border border-black/10 text-sm dark:border-white/20"
              >
                <button
                  type="button"
                  onClick={() => onPick(p)}
                  className="rounded-l-full py-1.5 pl-3 pr-1 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {chipText(p)}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(p.id)}
                  aria-label={`${dict.ui.deleteProfile}: ${p.label}`}
                  className="rounded-r-full py-1.5 pl-1 pr-2 text-xs opacity-50 hover:opacity-100"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </>
      )}
      {saveCandidate && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-fit rounded-lg border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
        >
          {justSaved ? dict.ui.profileSaved : dict.ui.saveAsProfile}
        </button>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { translateEnum, nakshatraName } from "@/lib/i18n";
import { BIRD_ICONS } from "@/components/icons/birds";
import type { BirdId, RashiId } from "@/lib/api-client";
import {
  listProfiles,
  addProfile,
  removeProfile,
  mergeLocalToServerOnce,
  type SavedProfile,
} from "@/lib/profiles";
import { useSessionProbe } from "@/lib/use-session-probe";

const RASHI_KEYS: RashiId[] = [
  "mesha",
  "vrishabha",
  "mithuna",
  "karka",
  "simha",
  "kanya",
  "tula",
  "vrischika",
  "dhanu",
  "makara",
  "kumbha",
  "meena",
];

// Renders the saved-profile chips and exposes a save affordance for the
// current result. Session state comes from the shared probe (one request per
// page load, shared with AccountMenu — see lib/use-session-probe.ts); a
// disabled auth system simply means "anonymous, local-only".
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
  const probe = useSessionProbe();
  const signedIn = Boolean(probe.user?.email);
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useCallback(async (isSignedIn: boolean) => {
    setProfiles(await listProfiles(isSignedIn));
  }, []);

  useEffect(() => {
    if (!probe.loaded) return;
    let cancelled = false;
    (async () => {
      if (signedIn) await mergeLocalToServerOnce();
      if (!cancelled) await refresh(signedIn);
    })();
    return () => {
      cancelled = true;
    };
  }, [probe.loaded, signedIn, refresh]);

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
      const moonRashiKey = p.moon_rashi_index ? RASHI_KEYS[p.moon_rashi_index - 1] : null;
      const moonRashi = moonRashiKey ? ` · ${translateEnum(dict, "rashis", moonRashiKey)}` : "";
      return `${p.label} · ${nakshatraName(p.nakshatra_index, locale)}${moonRashi}`;
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
                  className="flex min-h-9 items-center gap-2 rounded-l-full py-1.5 pl-3 pr-1 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  {p.bird && <ProfileBirdIcon bird={p.bird} />}
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

function ProfileBirdIcon({ bird }: { bird: BirdId }) {
  const Icon = BIRD_ICONS[bird];
  return <Icon className="shrink-0 text-lg" />;
}

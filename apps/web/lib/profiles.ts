"use client";

import type { BirdId, PakshaId } from "@/lib/api-client";

// A saved profile identifies a person's bird either directly or via
// (nakshatra, paksha) — never raw birth date/time/coordinates, in local
// storage or on the server. Field names deliberately match the server's
// profiles table so the login merge is a straight copy.
export type SavedProfile = {
  id: string;
  label: string;
  bird: BirdId | null;
  nakshatra_index: number | null;
  paksha: PakshaId | null;
  created_at: string;
};

const STORAGE_KEY = "ff_saved_profiles";

function loadLocal(): SavedProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedProfile[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(profiles: SavedProfile[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function sameIdentity(a: SavedProfile, b: SavedProfile): boolean {
  return (
    a.label === b.label &&
    a.bird === b.bird &&
    a.nakshatra_index === b.nakshatra_index &&
    a.paksha === b.paksha
  );
}

// ---------------------------------------------------------------------------
// Anonymous (local) backend — always available.

export function listLocalProfiles(): SavedProfile[] {
  return loadLocal();
}

export function addLocalProfile(
  input: Omit<SavedProfile, "id" | "created_at">,
): SavedProfile {
  const profile: SavedProfile = {
    ...input,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  };
  saveLocal([...loadLocal(), profile]);
  return profile;
}

export function removeLocalProfile(id: string) {
  saveLocal(loadLocal().filter((p) => p.id !== id));
}

// ---------------------------------------------------------------------------
// Server backend — used only while a session exists. All calls go through
// /api/account/* which takes the owner from the session cookie.

async function listServerProfiles(): Promise<SavedProfile[] | null> {
  const res = await fetch("/api/account/profiles");
  if (!res.ok) return null; // 401/404 -> treat as no server backend
  const data = await res.json();
  return data.profiles as SavedProfile[];
}

async function addServerProfile(
  input: Omit<SavedProfile, "id" | "created_at">,
): Promise<SavedProfile | null> {
  const res = await fetch("/api/account/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.profile as SavedProfile;
}

async function removeServerProfile(id: string): Promise<boolean> {
  const res = await fetch(`/api/account/profiles/${id}`, { method: "DELETE" });
  return res.ok;
}

// ---------------------------------------------------------------------------
// Unified interface. `signedIn` comes from the caller (AccountMenu-style
// session probe); when it's false everything is pure-local and no network
// request is ever made.

export async function listProfiles(signedIn: boolean): Promise<SavedProfile[]> {
  if (!signedIn) return listLocalProfiles();
  const server = await listServerProfiles();
  if (server === null) return listLocalProfiles();
  // Merge, not replace: a profile saved while signed in can land only in
  // localStorage (server write failed — validation, transient 5xx). If the
  // signed-in read showed the server list alone, that just-saved profile
  // would visibly vanish. Server rows win on identity collisions.
  const localOnly = listLocalProfiles().filter(
    (local) => !server.some((s) => sameIdentity(s, local)),
  );
  return [...server, ...localOnly];
}

export async function addProfile(
  signedIn: boolean,
  input: Omit<SavedProfile, "id" | "created_at">,
): Promise<SavedProfile> {
  if (signedIn) {
    const created = await addServerProfile(input);
    if (created) return created;
  }
  return addLocalProfile(input);
}

export async function removeProfile(signedIn: boolean, id: string): Promise<void> {
  if (signedIn && (await removeServerProfile(id))) return;
  removeLocalProfile(id);
}

// One-time upload merge on session start: local profiles that don't match an
// existing server row (by label + bird identity) get created server-side.
// Local copies are kept — signing out falls back to them unchanged.
const MERGE_DONE_KEY = "ff_profiles_merged";

export async function mergeLocalToServerOnce(): Promise<void> {
  if (window.sessionStorage.getItem(MERGE_DONE_KEY)) return;
  const server = await listServerProfiles();
  if (server === null) return; // not actually signed in / backend off
  // Flag BEFORE uploading, not after: the merge is a sequence of network
  // round-trips, and a language-switch remount mid-merge would re-enter with
  // the flag unset and a server snapshot that misses the in-flight inserts —
  // duplicating rows. Marking "merge attempted" up front makes re-entry a
  // no-op; any individual upload that failed is still visible via the merged
  // read in listProfiles (server + local-only), so nothing is lost.
  window.sessionStorage.setItem(MERGE_DONE_KEY, "1");
  for (const local of loadLocal()) {
    if (!server.some((s) => sameIdentity(s, local))) {
      await addServerProfile({
        label: local.label,
        bird: local.bird,
        nakshatra_index: local.nakshatra_index,
        paksha: local.paksha,
      });
    }
  }
}

"use client";

import { useEffect, useState } from "react";

export type ProbedSession = {
  // null while the probe is in flight; then a settled result.
  loaded: boolean;
  // Auth system reachable at all (flag on)?
  enabled: boolean;
  user: { email: string; name?: string; image?: string } | null;
};

const INITIAL: ProbedSession = { loaded: false, enabled: false, user: null };

// One probe per page load, shared by every consumer: AccountMenu and
// SavedProfiles both need "is auth on, and who am I" — probing twice was
// wasted network and two sources of truth. The module-level promise caches
// the in-flight/settled result; a 404 means the auth feature flag is off.
let probePromise: Promise<ProbedSession> | null = null;

function probe(): Promise<ProbedSession> {
  if (!probePromise) {
    probePromise = fetch("/api/auth/session")
      .then(async (res) => {
        if (!res.ok) return { loaded: true, enabled: false, user: null };
        const data = await res.json();
        return {
          loaded: true,
          enabled: true,
          user: data?.user?.email
            ? { email: data.user.email, name: data.user.name, image: data.user.image }
            : null,
        };
      })
      .catch(() => ({ loaded: true, enabled: false, user: null }));
  }
  return probePromise;
}

// Sign-in/out navigates away and back, so a fresh page load re-probes
// naturally; call this only if an in-page state change ever needs it.
export function resetSessionProbe() {
  probePromise = null;
}

export function useSessionProbe(): ProbedSession {
  const [state, setState] = useState<ProbedSession>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    probe().then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

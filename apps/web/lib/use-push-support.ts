"use client";

import { useEffect, useState } from "react";

export type PushSupport = {
  loaded: boolean;
  // Server has VAPID configured AND this browser supports the Push API.
  available: boolean;
  publicKey: string | null;
};

const INITIAL: PushSupport = { loaded: false, available: false, publicKey: null };

// Same pattern as use-session-probe: one probe per page load shared by all
// consumers. A 404 from /api/push/public-key means push isn't configured on
// this deployment — the opt-in UI then renders nothing at all.
let probePromise: Promise<PushSupport> | null = null;

function probe(): Promise<PushSupport> {
  if (!probePromise) {
    const browserSupports =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    probePromise = !browserSupports
      ? Promise.resolve({ loaded: true, available: false, publicKey: null })
      : fetch("/api/push/public-key")
          .then(async (res) => {
            if (!res.ok) return { loaded: true, available: false, publicKey: null };
            const data = await res.json();
            return { loaded: true, available: Boolean(data.key), publicKey: data.key ?? null };
          })
          .catch(() => ({ loaded: true, available: false, publicKey: null }));
  }
  return probePromise;
}

export function usePushSupport(): PushSupport {
  const [state, setState] = useState<PushSupport>(INITIAL);

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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/locale-context";

const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" };

export function ServiceWorkerRegister() {
  const { dict } = useLocale();
  const [isOnline, setIsOnline] = useState(true);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshRequested = useRef(false);
  const reloaded = useRef(false);

  useEffect(() => {
    const syncOnlineStatus = () => setIsOnline(navigator.onLine);
    syncOnlineStatus();
    window.addEventListener("online", syncOnlineStatus);
    window.addEventListener("offline", syncOnlineStatus);
    return () => {
      window.removeEventListener("online", syncOnlineStatus);
      window.removeEventListener("offline", syncOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;

    const syncWaitingWorker = () => {
      // A first install has no controller, so it is not an update the visitor
      // needs to act on. Only surface workers waiting to replace an active app.
      const worker = registration?.waiting;
      if (!disposed && worker && navigator.serviceWorker.controller) setWaitingWorker(worker);
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", syncWaitingWorker);
    };

    const onControllerChange = () => {
      if (refreshRequested.current && !reloaded.current) {
        reloaded.current = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker
      .register("/sw.js")
      .then((nextRegistration) => {
        if (disposed) return;
        registration = nextRegistration;
        registration.addEventListener("updatefound", onUpdateFound);
        syncWaitingWorker();
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
      registration?.installing?.removeEventListener("statechange", syncWaitingWorker);
    };
  }, []);

  const refresh = useCallback(() => {
    if (!waitingWorker) return;
    refreshRequested.current = true;
    setIsRefreshing(true);
    waitingWorker.postMessage(SKIP_WAITING_MESSAGE);
  }, [waitingWorker]);

  if (isOnline && !waitingWorker) return null;

  return (
    <div className="border-b border-black/10 bg-amber-50/80 dark:border-white/10 dark:bg-amber-950/20">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        {!isOnline && (
          <div role="status" aria-live="polite" data-testid="pwa-offline-status" className="flex items-start gap-2">
            <span aria-hidden="true">◌</span>
            <p>
              <span className="font-semibold">{dict.ui.offline}.</span> {dict.ui.offlineAppNotice}
            </p>
          </div>
        )}
        {waitingWorker && (
          <div role="status" aria-live="polite" data-testid="pwa-update-ready" className="flex items-center gap-3">
            <span aria-hidden="true">↻</span>
            <p className="font-medium">{dict.ui.updateAvailable}</p>
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="rounded-full border border-accent px-3 py-1 font-semibold text-accent transition hover:bg-accent/10 disabled:cursor-wait disabled:opacity-70"
            >
              {isRefreshing ? dict.ui.refreshing : dict.ui.refresh}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

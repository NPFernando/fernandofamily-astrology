"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";

const DISMISS_KEY = "ff_install_prompt_dismissed";

type InstallChoice = { outcome: "accepted" | "dismissed" };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isIosSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isAppleMobile && isSafari;
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Ignore private-mode storage failures; the button can reappear later.
  }
}

export function InstallAppButton() {
  const { dict } = useLocale();
  const [environment, setEnvironment] = useState({
    mounted: false,
    standalone: false,
    iosSafari: false,
    dismissed: false,
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    // Browser install eligibility is only knowable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnvironment({
      mounted: true,
      standalone: isStandaloneDisplay(),
      iosSafari: isIosSafari(),
      dismissed: wasDismissed(),
    });

    const handlePrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      if (typeof promptEvent.prompt !== "function") return;
      event.preventDefault();
      setDeferredPrompt(promptEvent);
      setEnvironment((prev) => ({ ...prev, dismissed: false }));
    };
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setShowGuide(false);
      setEnvironment((prev) => ({ ...prev, standalone: true }));
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const hideForNow = useCallback(() => {
    rememberDismissed();
    setEnvironment((prev) => ({ ...prev, dismissed: true }));
    setShowGuide(false);
  }, []);

  const install = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        setEnvironment((prev) => ({ ...prev, standalone: true }));
      }
      return;
    }
    if (environment.iosSafari) setShowGuide(true);
  }, [deferredPrompt, environment.iosSafari]);

  const available =
    environment.mounted &&
    !environment.standalone &&
    !environment.dismissed &&
    (deferredPrompt !== null || environment.iosSafari);
  if (!available) return null;

  return (
    <>
      <button
        type="button"
        onClick={install}
        aria-label={dict.ui.installApp}
        title={dict.ui.installApp}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/70 text-sm shadow-sm transition hover:border-accent hover:bg-accent/10 dark:border-white/20 dark:bg-white/5"
        data-testid="install-app"
      >
        <Image src="/icons/app/icon-192.png" alt="" width={22} height={22} className="rounded-md" />
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/35 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
          role="presentation"
          data-testid="install-guide"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
            className="w-full max-w-sm rounded-lg border border-black/10 bg-background p-4 shadow-xl dark:border-white/15"
          >
            <div className="flex items-start gap-3">
              <Image src="/icons/app/icon-192.png" alt="" width={40} height={40} className="rounded-lg" />
              <div className="min-w-0">
                <h2 id="install-guide-title" className="text-base font-semibold">
                  {dict.ui.installGuideTitle}
                </h2>
                <p className="mt-1 text-sm opacity-80">{dict.ui.installGuideBody}</p>
              </div>
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              <li>{dict.ui.installIosStepShare}</li>
              <li>{dict.ui.installIosStepAdd}</li>
              <li>{dict.ui.installIosStepConfirm}</li>
            </ol>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={hideForNow}
                className="rounded-full border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
              >
                {dict.ui.notNow}
              </button>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-white"
              >
                {dict.ui.close}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

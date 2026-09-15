"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useLocale } from "@/lib/locale-context";
import { useSessionProbe } from "@/lib/use-session-probe";
import { AccountDefaultsPanel } from "@/components/layout/AccountDefaultsPanel";
import { useLocalVault } from "@/components/LocalVaultProvider";

const EXPIRED_ACCOUNT_SESSION_KEY = "ff_account_session_expired_email";

// Self-detecting via the shared session probe (one network request per page
// load, shared with SavedProfiles — see lib/use-session-probe.ts). When auth
// isn't configured the probe reports disabled and this renders nothing at
// all — the pre-auth UI, unchanged. The flag can't be decided server-side in
// the layout: locale pages are statically prerendered at image build time
// (without secrets, which must never be baked into a published image), so
// only a runtime probe reflects the deployed container's actual env.
// signIn/signOut from next-auth/react handle the CSRF handshake and work
// without a <SessionProvider>.
export function AccountMenu() {
  const { dict } = useLocale();
  const { loaded, enabled, user: session } = useSessionProbe();
  const { lock: lockPrivateData } = useLocalVault();
  const [open, setOpen] = useState(false);
  const [expiredSessionEmail, setExpiredSessionEmail] = useState<string | null>(
    () =>
      typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(EXPIRED_ACCOUNT_SESSION_KEY),
  );
  const sessionExpired = Boolean(session?.email && expiredSessionEmail === session.email);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.email) return;
    const email = session.email;
    if (window.sessionStorage.getItem(EXPIRED_ACCOUNT_SESSION_KEY) === email) return;

    let checking = false;
    async function verifyAccountSession() {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) return;
        const current = await response.json();
        if (current?.user?.email === email) {
          window.sessionStorage.removeItem(EXPIRED_ACCOUNT_SESSION_KEY);
          if (expiredSessionEmail === email) setExpiredSessionEmail(null);
          return;
        }
        window.sessionStorage.setItem(EXPIRED_ACCOUNT_SESSION_KEY, email);
        setExpiredSessionEmail(email);
        lockPrivateData();
      } catch {
        // A network failure is not proof that authentication has expired.
      } finally {
        checking = false;
      }
    }

    const timer = window.setInterval(() => void verifyAccountSession(), 60_000);
    const onFocus = () => void verifyAccountSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void verifyAccountSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [expiredSessionEmail, lockPrivateData, session?.email]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  if (!loaded || !enabled) return null;

  if (!session || sessionExpired) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        {dict.ui.signIn}
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-black/10 px-2 py-1.5 text-sm dark:border-white/20"
      >
        {session.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny avatar from Google's CDN; next/image gains nothing here
          <img src={session.image} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/20 text-xs">
            {session.email[0]?.toUpperCase()}
          </span>
        )}
        <span className="max-w-[10rem] truncate">{session.name ?? session.email}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-black/10 bg-white p-2 text-sm shadow-lg dark:border-white/20 dark:bg-neutral-900">
          <p className="truncate px-2 py-1 text-xs opacity-70">{session.email}</p>
          <button
            type="button"
            onClick={() => {
              window.sessionStorage.setItem(EXPIRED_ACCOUNT_SESSION_KEY, session.email);
              setExpiredSessionEmail(session.email);
              lockPrivateData();
              void signOut();
            }}
            className="w-full rounded px-2 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
          >
            {dict.ui.signOut}
          </button>
          <AccountDefaultsPanel />
        </div>
      )}
    </div>
  );
}

"use client";

import { FormEvent, useState } from "react";
import { useLocalVault } from "@/components/LocalVaultProvider";
import { useLocale } from "@/lib/locale-context";

export function LocalVaultControl() {
  const { dict } = useLocale();
  const { hasEncryptedData, ready, unlocked, unlock } = useLocalVault();
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!ready) return null;
  if (unlocked) {
    return <span className="text-xs opacity-65" title={dict.ui.vaultUnlocked}>🔒</span>;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      if (!(await unlock(passphrase))) {
        setError(dict.ui.vaultUnlockFailed);
        return;
      }
      setPassphrase("");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : dict.ui.error);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rounded-lg border border-black/10 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        {hasEncryptedData ? dict.ui.unlockPrivateData : dict.ui.protectPrivateData}
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-black/10 bg-white p-3 text-sm shadow-lg dark:border-white/20 dark:bg-neutral-900"
        >
          <label htmlFor="local-vault-passphrase" className="block font-medium">
            {hasEncryptedData ? dict.ui.vaultPassphrase : dict.ui.chooseVaultPassphrase}
          </label>
          <p className="mt-1 text-xs leading-relaxed opacity-70">
            {dict.ui.vaultPassphraseHint}
          </p>
          <input
            id="local-vault-passphrase"
            type="password"
            autoComplete={hasEncryptedData ? "current-password" : "new-password"}
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            className="mt-3 w-full rounded border border-black/15 bg-transparent px-2 py-1.5 dark:border-white/20"
            required
          />
          {error && <p role="alert" className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <button type="submit" className="mt-3 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white">
            {hasEncryptedData ? dict.ui.unlockVault : dict.ui.createVault}
          </button>
        </form>
      )}
    </div>
  );
}

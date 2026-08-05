"use client";

import { useRef, useState } from "react";
import { useLocalVault } from "@/components/LocalVaultProvider";
import { useLocale } from "@/lib/locale-context";

const BACKUP_FILENAME = "fernando-family-private-vault-v1.json";

export function VaultBackupControls() {
  const { dict } = useLocale();
  const { ready, hasEncryptedData, exportBackup, importBackup } = useLocalVault();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!ready) return null;

  function downloadBackup() {
    const backup = exportBackup();
    if (!backup) {
      setMessage(dict.ui.vaultBackupUnavailable);
      return;
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = BACKUP_FILENAME;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(dict.ui.vaultBackupDownloaded);
  }

  async function restoreBackup(file: File | undefined) {
    if (!file) return;
    const result = importBackup(await file.text());
    setMessage(
      result === "imported"
        ? dict.ui.vaultBackupRestored
        : result === "existing_vault"
          ? dict.ui.vaultBackupExisting
          : dict.ui.vaultBackupInvalid,
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-black/10 p-4 dark:border-white/15" data-testid="vault-backup-controls">
      <h2 className="text-lg font-semibold">{dict.ui.vaultBackupTitle}</h2>
      <p className="mt-2 text-sm leading-relaxed opacity-80">{dict.ui.vaultBackupBody}</p>
      <p className="mt-2 text-sm font-medium">{dict.ui.vaultBackupRecoveryWarning}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={downloadBackup}
          disabled={!hasEncryptedData}
          data-testid="vault-backup-download"
          className="rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {dict.ui.downloadVaultBackup}
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={hasEncryptedData}
          className="rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {dict.ui.restoreVaultBackup}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          data-testid="vault-backup-upload"
          className="sr-only"
          disabled={hasEncryptedData}
          onChange={(event) => {
            void restoreBackup(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {hasEncryptedData && <p className="mt-3 text-xs opacity-75">{dict.ui.vaultBackupExisting}</p>}
      {message && <p role="status" className="mt-3 text-sm text-accent">{message}</p>}
    </section>
  );
}

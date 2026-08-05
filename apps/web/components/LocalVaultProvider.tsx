"use client";

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  activeVaultKey,
  applyVaultPassphraseRotation,
  clearLegacySensitiveStorage,
  clearVault,
  deriveVaultKey,
  exportVaultBackup,
  hasVault,
  importVaultBackup,
  readVault,
  setVaultBackupRecommended,
  setActiveVaultKey,
  type VaultBackup,
  type VaultBackupImportResult,
  vaultBackupRecommended,
  writeVault,
} from "@/lib/local-vault";
import type {
  CachedSchedule,
  DerivedIdentitySeed,
  LiveScheduleSeed,
  SessionSchedule,
} from "@/lib/pancha-schedule-state";
import type { BirdId } from "@/lib/api-client";

export type LocalVaultData = {
  recentBirthDetails?: { birth_date: string; birth_time: string }[];
  recentLocations?: { name: string; latitude: number; longitude: number; iana_tz: string }[];
  cachedSchedule?: CachedSchedule;
  sessionSchedule?: SessionSchedule;
  liveScheduleSeed?: LiveScheduleSeed;
  derivedIdentitySeed?: DerivedIdentitySeed;
  selectedBird?: BirdId;
};

type VaultContextValue = {
  data: LocalVaultData;
  ready: boolean;
  unlocked: boolean;
  hasEncryptedData: boolean;
  backupRecommended: boolean;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => void;
  update: (updater: (current: LocalVaultData) => LocalVaultData) => Promise<void>;
  rotatePassphrase: (passphrase: string) => Promise<boolean>;
  exportBackup: () => VaultBackup | null;
  importBackup: (serialized: string) => VaultBackupImportResult;
  clear: () => void;
};

const LocalVaultContext = createContext<VaultContextValue | null>(null);

export function LocalVaultProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LocalVaultData>({});
  const [key, setKey] = useState<CryptoKey | null>(() => activeVaultKey());
  const [ready, setReady] = useState(false);
  const [hasEncryptedData, setHasEncryptedData] = useState(false);
  const [backupRecommended, setBackupRecommended] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const dataRef = useRef<LocalVaultData>({});
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionEpochRef = useRef(0);

  const commit = useCallback(async (vaultKey: CryptoKey, next: LocalVaultData) => {
    const operation = writeQueueRef.current.then(async () => {
      await writeVault(vaultKey, next);
      dataRef.current = next;
      setData(next);
      setHasEncryptedData(true);
    });
    writeQueueRef.current = operation.catch(() => undefined);
    await operation;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const retainedKey = activeVaultKey();
      if (retainedKey) {
        const retainedData = await readVault<LocalVaultData>(retainedKey);
        if (!cancelled && retainedData) {
          dataRef.current = retainedData;
          setKey(retainedKey);
          setData(retainedData);
        }
      }
      if (!cancelled) {
        setHasEncryptedData(hasVault());
        setBackupRecommended(vaultBackupRecommended());
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const legacyData = useCallback((): LocalVaultData => {
    function read<T>(storage: Storage, name: string): T | undefined {
      try {
        const raw = storage.getItem(name);
        return raw ? (JSON.parse(raw) as T) : undefined;
      } catch {
        return undefined;
      }
    }
    function readBird(): BirdId | undefined {
      const bird = window.localStorage.getItem("ff_selected_bird");
      return bird === "vulture" || bird === "owl" || bird === "crow" || bird === "cock" || bird === "peacock"
        ? bird
        : undefined;
    }
    return {
      recentBirthDetails: read(window.localStorage, "ff_recent_birth_details"),
      recentLocations: read(window.localStorage, "ff_recent_locations"),
      cachedSchedule: read(window.localStorage, "ff_last_schedule_cache"),
      sessionSchedule: read(window.sessionStorage, "ff_session_schedule"),
      liveScheduleSeed: read(window.sessionStorage, "ff_live_schedule_seed"),
      derivedIdentitySeed: read(window.sessionStorage, "ff_derived_identity_seed"),
      selectedBird: readBird(),
    };
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    const alreadyEncrypted = hasVault();
    const nextKey = await deriveVaultKey(passphrase);
    const stored = await readVault<LocalVaultData>(nextKey);
    if (alreadyEncrypted && stored === null) return false;

    // Existing encrypted values win. This only imports stale legacy values
    // that were never encrypted (for example if an earlier tab was closed
    // mid-migration).
    const legacy = legacyData();
    const next = {
      ...legacy,
      ...(stored ?? {}),
      recentBirthDetails: stored?.recentBirthDetails ?? legacy.recentBirthDetails,
      recentLocations: stored?.recentLocations ?? legacy.recentLocations,
      cachedSchedule: stored?.cachedSchedule ?? legacy.cachedSchedule,
      sessionSchedule: stored?.sessionSchedule ?? legacy.sessionSchedule,
      liveScheduleSeed: stored?.liveScheduleSeed ?? legacy.liveScheduleSeed,
      derivedIdentitySeed: stored?.derivedIdentitySeed ?? legacy.derivedIdentitySeed,
      selectedBird: stored?.selectedBird ?? legacy.selectedBird,
    } satisfies LocalVaultData;

    // Creating an empty encrypted payload makes "Create vault" durable even
    // before the user saves a calculator value. Delete clear-text legacy keys
    // only after this authenticated write succeeds.
    await commit(nextKey, next);
    clearLegacySensitiveStorage();
    if (!alreadyEncrypted) {
      setVaultBackupRecommended(true);
      setBackupRecommended(true);
    }
    setActiveVaultKey(nextKey);
    setKey(nextKey);
    setSessionVersion((version) => version + 1);
    return true;
  }, [commit, legacyData]);

  const update = useCallback(
    async (updater: (current: LocalVaultData) => LocalVaultData) => {
      if (!key) throw new Error("Unlock the private data vault before saving.");
      const sessionEpoch = sessionEpochRef.current;
      const operation = writeQueueRef.current.then(async () => {
        // A lock invalidates work that was waiting behind an earlier vault
        // write. It must neither write stale values nor repopulate this tab's
        // in-memory data after the user has explicitly locked it.
        if (sessionEpoch !== sessionEpochRef.current || activeVaultKey() !== key) return;
        const next = updater(dataRef.current);
        await writeVault(key, next);
        if (sessionEpoch !== sessionEpochRef.current || activeVaultKey() !== key) return;
        dataRef.current = next;
        setData(next);
        setHasEncryptedData(true);
      });
      writeQueueRef.current = operation.catch(() => undefined);
      await operation;
    },
    [key],
  );

  const clear = useCallback(() => {
    sessionEpochRef.current += 1;
    clearVault();
    clearLegacySensitiveStorage();
    dataRef.current = {};
    setData({});
    setKey(null);
    setActiveVaultKey(null);
    setHasEncryptedData(false);
    setBackupRecommended(false);
    setSessionVersion((version) => version + 1);
  }, []);

  const rotatePassphrase = useCallback(async (passphrase: string) => {
    if (!key) return false;
    const sessionEpoch = sessionEpochRef.current;
    const vaultKey = key;
    const operation = writeQueueRef.current.then(async () => {
      if (sessionEpoch !== sessionEpochRef.current || activeVaultKey() !== vaultKey) return false;
      const replacementKey = await applyVaultPassphraseRotation(
        passphrase,
        dataRef.current,
        () => sessionEpoch === sessionEpochRef.current && activeVaultKey() === vaultKey,
      );
      if (!replacementKey) return false;
      setActiveVaultKey(replacementKey);
      setKey(replacementKey);
      setVaultBackupRecommended(true);
      setBackupRecommended(true);
      return true;
    });
    writeQueueRef.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, [key]);

  const lock = useCallback(() => {
    // Retain only authenticated ciphertext in browser storage. Remounting the
    // child tree drops private values held in individual calculator forms.
    sessionEpochRef.current += 1;
    dataRef.current = {};
    setData({});
    setKey(null);
    setActiveVaultKey(null);
    setHasEncryptedData(hasVault());
    setSessionVersion((version) => version + 1);
  }, []);

  const exportBackup = useCallback(() => {
    const backup = exportVaultBackup();
    if (backup) {
      setVaultBackupRecommended(false);
      setBackupRecommended(false);
    }
    return backup;
  }, []);

  const importBackup = useCallback((serialized: string): VaultBackupImportResult => {
    const result = importVaultBackup(serialized);
    if (result !== "imported") return result;
    // Imported ciphertext is intentionally locked. Do not retain a key or
    // prior in-memory data from this tab, and do not preserve legacy cleartext.
    clearLegacySensitiveStorage();
    sessionEpochRef.current += 1;
    dataRef.current = {};
    setData({});
    setKey(null);
    setActiveVaultKey(null);
    setHasEncryptedData(true);
    setVaultBackupRecommended(false);
    setBackupRecommended(false);
    return result;
  }, []);

  const value = useMemo(
    () => ({ data, ready, unlocked: key !== null, hasEncryptedData, backupRecommended, unlock, lock, update, rotatePassphrase, exportBackup, importBackup, clear }),
    [backupRecommended, clear, data, exportBackup, hasEncryptedData, importBackup, key, lock, ready, rotatePassphrase, unlock, update],
  );
  return (
    <LocalVaultContext.Provider value={value}>
      <Fragment key={sessionVersion}>{children}</Fragment>
    </LocalVaultContext.Provider>
  );
}

export function useLocalVault(): VaultContextValue {
  const value = useContext(LocalVaultContext);
  if (!value) throw new Error("useLocalVault must be used inside LocalVaultProvider.");
  return value;
}

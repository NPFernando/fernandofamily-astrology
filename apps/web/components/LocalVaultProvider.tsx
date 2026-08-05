"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  activeVaultKey,
  clearLegacySensitiveStorage,
  clearVault,
  deriveVaultKey,
  hasVault,
  readVault,
  setActiveVaultKey,
  writeVault,
} from "@/lib/local-vault";
import { setMostRecentVaultLocation } from "@/lib/vault-location-cache";
import type {
  CachedSchedule,
  DerivedIdentitySeed,
  LiveScheduleSeed,
  SessionSchedule,
} from "@/lib/pancha-schedule-state";

export type LocalVaultData = {
  recentBirthDetails?: { birth_date: string; birth_time: string }[];
  recentLocations?: { name: string; latitude: number; longitude: number; iana_tz: string }[];
  cachedSchedule?: CachedSchedule;
  sessionSchedule?: SessionSchedule;
  liveScheduleSeed?: LiveScheduleSeed;
  derivedIdentitySeed?: DerivedIdentitySeed;
};

type VaultContextValue = {
  data: LocalVaultData;
  ready: boolean;
  unlocked: boolean;
  hasEncryptedData: boolean;
  unlock: (passphrase: string) => Promise<boolean>;
  update: (updater: (current: LocalVaultData) => LocalVaultData) => Promise<void>;
  clear: () => void;
};

const LocalVaultContext = createContext<VaultContextValue | null>(null);

export function LocalVaultProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LocalVaultData>({});
  const [key, setKey] = useState<CryptoKey | null>(() => activeVaultKey());
  const [ready, setReady] = useState(false);
  const [hasEncryptedData, setHasEncryptedData] = useState(false);
  const dataRef = useRef<LocalVaultData>({});
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback(async (vaultKey: CryptoKey, next: LocalVaultData) => {
    const operation = writeQueueRef.current.then(async () => {
      await writeVault(vaultKey, next);
      dataRef.current = next;
      setData(next);
      setMostRecentVaultLocation(next.recentLocations?.[0] ?? null);
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
          setMostRecentVaultLocation(retainedData.recentLocations?.[0] ?? null);
        }
      }
      if (!cancelled) {
        setHasEncryptedData(hasVault());
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
    return {
      recentBirthDetails: read(window.localStorage, "ff_recent_birth_details"),
      recentLocations: read(window.localStorage, "ff_recent_locations"),
      cachedSchedule: read(window.localStorage, "ff_last_schedule_cache"),
      sessionSchedule: read(window.sessionStorage, "ff_session_schedule"),
      liveScheduleSeed: read(window.sessionStorage, "ff_live_schedule_seed"),
      derivedIdentitySeed: read(window.sessionStorage, "ff_derived_identity_seed"),
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
    } satisfies LocalVaultData;

    // Creating an empty encrypted payload makes "Create vault" durable even
    // before the user saves a calculator value. Delete clear-text legacy keys
    // only after this authenticated write succeeds.
    await commit(nextKey, next);
    clearLegacySensitiveStorage();
    setActiveVaultKey(nextKey);
    setKey(nextKey);
    return true;
  }, [commit, legacyData]);

  const update = useCallback(
    async (updater: (current: LocalVaultData) => LocalVaultData) => {
      if (!key) throw new Error("Unlock the private data vault before saving.");
      const operation = writeQueueRef.current.then(async () => {
        const next = updater(dataRef.current);
        await writeVault(key, next);
        dataRef.current = next;
        setData(next);
        setMostRecentVaultLocation(next.recentLocations?.[0] ?? null);
        setHasEncryptedData(true);
      });
      writeQueueRef.current = operation.catch(() => undefined);
      await operation;
    },
    [key],
  );

  const clear = useCallback(() => {
    clearVault();
    clearLegacySensitiveStorage();
    dataRef.current = {};
    setData({});
    setKey(null);
    setActiveVaultKey(null);
    setMostRecentVaultLocation(null);
    setHasEncryptedData(false);
  }, []);

  const value = useMemo(
    () => ({ data, ready, unlocked: key !== null, hasEncryptedData, unlock, update, clear }),
    [clear, data, hasEncryptedData, key, ready, unlock, update],
  );
  return <LocalVaultContext.Provider value={value}>{children}</LocalVaultContext.Provider>;
}

export function useLocalVault(): VaultContextValue {
  const value = useContext(LocalVaultContext);
  if (!value) throw new Error("useLocalVault must be used inside LocalVaultProvider.");
  return value;
}

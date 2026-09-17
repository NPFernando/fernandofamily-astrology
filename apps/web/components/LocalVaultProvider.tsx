'use client'

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  activeVaultKey,
  announceVaultLock,
  applyVaultPassphraseRotation,
  clearLegacySensitiveStorage,
  clearVault,
  deriveVaultKey,
  exportVaultBackup,
  hasVault,
  hasLegacySensitiveStorage,
  importVaultBackup,
  LOCAL_VAULT_LOCK_SIGNAL_KEY,
  LOCAL_VAULT_PAYLOAD_STORAGE_KEY,
  LOCAL_VAULT_SALT_STORAGE_KEY,
  readVault,
  setVaultBackupRecommended,
  setActiveVaultKey,
  type VaultBackup,
  type VaultBackupImportResult,
  vaultBackupRecommended,
  writeVault
} from '@/lib/local-vault'
import type {
  CachedSchedule,
  DerivedIdentitySeed,
  LiveScheduleSeed,
  SessionSchedule,
} from '@/lib/pancha-schedule-state'
import type { BirdId, DailyPanchanga, ScheduleRequest, ScheduleResponse } from '@/lib/api-client'
import type { VaultFamilyGroup, VaultPlan } from '@/lib/planner'
import type { PrivatePerson } from '@/lib/private-people'
import { clearEphemeralDerivedIdentitySeed } from '@/lib/ephemeral-derived-identity'
import {
  clearMigratedLegacyAccountLocation,
  discardInvalidLegacyAccountLocation as discardInvalidLegacyAccountLocationOnServer,
  hasLegacyAccountLocationPending,
  loadLegacyAccountLocationForVaultMigration,
} from '@/lib/account-preferences'
import type { LocationValue } from '@/components/pancha-pakshi/LocationPicker'
import { listLocalProfiles } from '@/lib/profiles'

export type CachedDailyGuide = {
  request: ScheduleRequest
  panchanga: DailyPanchanga
  schedule: ScheduleResponse
  referenceAt: string
  cachedAtIso: string
}

export type LocalVaultData = {
  privatePeople?: PrivatePerson[]
  recentBirthDetails?: { birth_date: string; birth_time: string }[]
  recentLocations?: { name: string; latitude: number; longitude: number; iana_tz: string }[]
  defaultLocation?: LocationValue
  cachedSchedule?: CachedSchedule
  cachedDailyGuide?: CachedDailyGuide
  plans?: VaultPlan[]
  familyGroups?: VaultFamilyGroup[]
  sessionSchedule?: SessionSchedule
  liveScheduleSeed?: LiveScheduleSeed
  derivedIdentitySeed?: DerivedIdentitySeed
  selectedBird?: BirdId
}

type VaultContextValue = {
  data: LocalVaultData
  ready: boolean
  unlocked: boolean
  hasEncryptedData: boolean
  legacyMigrationPending: boolean
  invalidLegacyAccountLocation: boolean
  backupRecommended: boolean
  unlock: (passphrase: string) => Promise<boolean>
  lock: () => void
  update: (updater: (current: LocalVaultData) => LocalVaultData) => Promise<void>
  clearEphemeralData: () => Promise<void>
  rotatePassphrase: (passphrase: string) => Promise<boolean>
  exportBackup: () => VaultBackup | null
  importBackup: (serialized: string) => VaultBackupImportResult
  discardInvalidLegacyAccountLocation: () => Promise<boolean>
  clear: () => void
}

const LocalVaultContext = createContext<VaultContextValue | null>(null)

function sameLocation(left: LocationValue | undefined | null, right: LocationValue): boolean {
  return Boolean(
    left &&
      left.name === right.name &&
      left.latitude === right.latitude &&
      left.longitude === right.longitude &&
      left.iana_tz === right.iana_tz
  )
}

export function LocalVaultProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<LocalVaultData>({})
  const [key, setKey] = useState<CryptoKey | null>(() => activeVaultKey())
  const [ready, setReady] = useState(false)
  const [hasEncryptedData, setHasEncryptedData] = useState(false)
  const [legacyMigrationPending, setLegacyMigrationPending] = useState(false)
  const [invalidLegacyAccountLocation, setInvalidLegacyAccountLocation] = useState(false)
  const [legacyAccountLocationRevision, setLegacyAccountLocationRevision] = useState<string | null>(null)
  const [backupRecommended, setBackupRecommended] = useState(false)
  const [sessionVersion, setSessionVersion] = useState(0)
  const dataRef = useRef<LocalVaultData>({})
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve())
  const sessionEpochRef = useRef(0)
  const unlockAttemptRef = useRef(0)
  const legacyMigrationStatusVersionRef = useRef(0)

  const commit = useCallback(async (
    vaultKey: CryptoKey,
    next: LocalVaultData,
    canCommit: () => boolean = () => true,
  ) => {
    const operation = writeQueueRef.current.then(async () => {
      if (!canCommit()) return false
      const written = await writeVault(vaultKey, next, canCommit)
      if (!written || !canCommit()) return false
      dataRef.current = next
      setData(next)
      setHasEncryptedData(true)
      return true
    })
    writeQueueRef.current = operation.then(() => undefined, () => undefined)
    return operation
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Strip unsupported properties from the derived-only profile cache at
      // app startup, including any legacy birth details or coordinates.
      listLocalProfiles();
      const retainedKey = activeVaultKey();
      if (retainedKey) {
        const retainedData = await readVault<LocalVaultData>(retainedKey)
        if (!cancelled && retainedData) {
          dataRef.current = retainedData
          setKey(retainedKey)
          setData(retainedData)
        }
      }
      if (!cancelled) {
        const localMigrationPending = hasLegacySensitiveStorage()
        setHasEncryptedData(hasVault())
        setLegacyMigrationPending(localMigrationPending)
        setBackupRecommended(vaultBackupRecommended())
        setReady(true)
        const statusVersion = legacyMigrationStatusVersionRef.current
        void hasLegacyAccountLocationPending().then((accountLocationPending) => {
          if (!cancelled && legacyMigrationStatusVersionRef.current === statusVersion) {
            setLegacyMigrationPending(localMigrationPending || accountLocationPending)
          }
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function discardDecryptedState() {
      sessionEpochRef.current += 1
      legacyMigrationStatusVersionRef.current += 1
      clearEphemeralDerivedIdentitySeed()
      dataRef.current = {}
      setData({})
      setKey(null)
      setActiveVaultKey(null)
      setInvalidLegacyAccountLocation(false)
      setLegacyAccountLocationRevision(null)
      setHasEncryptedData(window.localStorage.getItem(LOCAL_VAULT_PAYLOAD_STORAGE_KEY) !== null)
      const statusVersion = ++legacyMigrationStatusVersionRef.current
      const localMigrationPending = hasLegacySensitiveStorage()
      setLegacyMigrationPending(localMigrationPending)
      void hasLegacyAccountLocationPending().then((accountLocationPending) => {
        if (legacyMigrationStatusVersionRef.current === statusVersion) {
          setLegacyMigrationPending(localMigrationPending || accountLocationPending)
        }
      })
      setSessionVersion(version => version + 1)
    }

    function onStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) return
      if (event.key === LOCAL_VAULT_LOCK_SIGNAL_KEY) {
        discardDecryptedState()
        return
      }
      if (event.key !== LOCAL_VAULT_PAYLOAD_STORAGE_KEY && event.key !== LOCAL_VAULT_SALT_STORAGE_KEY) return

      // The payload may have been updated or re-encrypted by another tab.
      // Requiring a local re-unlock avoids stale decrypted forms and makes a
      // passphrase rotation invalidate every other tab immediately.
      if (key) discardDecryptedState()
      else {
        sessionEpochRef.current += 1
        unlockAttemptRef.current += 1
        setHasEncryptedData(window.localStorage.getItem(LOCAL_VAULT_PAYLOAD_STORAGE_KEY) !== null)
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  useEffect(() => () => {
    sessionEpochRef.current += 1
    unlockAttemptRef.current += 1
  }, [])

  const legacyData = useCallback((): LocalVaultData => {
    function read<T>(storage: Storage, name: string): T | undefined {
      try {
        const raw = storage.getItem(name)
        return raw ? (JSON.parse(raw) as T) : undefined
      } catch {
        return undefined
      }
    }
    function readBird(): BirdId | undefined {
      const bird = window.localStorage.getItem('ff_selected_bird')
      return bird === 'vulture' || bird === 'owl' || bird === 'crow' || bird === 'cock' || bird === 'peacock'
        ? bird
        : undefined
    }
    return {
      recentBirthDetails: read(window.localStorage, 'ff_recent_birth_details'),
      recentLocations: read(window.localStorage, 'ff_recent_locations'),
      cachedSchedule: read(window.localStorage, 'ff_last_schedule_cache'),
      sessionSchedule: read(window.sessionStorage, 'ff_session_schedule'),
      liveScheduleSeed: read(window.sessionStorage, 'ff_live_schedule_seed'),
      derivedIdentitySeed: read(window.sessionStorage, 'ff_derived_identity_seed'),
      selectedBird: readBird()
    }
  }, [])

  const unlock = useCallback(
    async (passphrase: string) => {
      const attempt = ++unlockAttemptRef.current
      const sessionEpoch = sessionEpochRef.current
      const canCommit = () =>
        sessionEpoch === sessionEpochRef.current &&
        attempt === unlockAttemptRef.current
      const alreadyEncrypted = hasVault()
      const nextKey = await deriveVaultKey(passphrase)
      if (!canCommit()) return false
      const stored = await readVault<LocalVaultData>(nextKey)
      if (!canCommit()) return false
      if (alreadyEncrypted && stored === null) return false

      // Existing encrypted values win. This only imports stale legacy values
      // that were never encrypted (for example if an earlier tab was closed
      // mid-migration).
      const legacy = legacyData()
      const legacyAccountLocation = await loadLegacyAccountLocationForVaultMigration()
      if (!canCommit()) return false
      const accountLocation = legacyAccountLocation.location
      const storedRecentLocations = stored?.recentLocations ?? legacy.recentLocations ?? []
      let recentLocations = storedRecentLocations
      if (
        accountLocation &&
        stored?.defaultLocation &&
        !sameLocation(stored.defaultLocation, accountLocation) &&
        !storedRecentLocations.some((location) => sameLocation(location, accountLocation))
      ) {
        recentLocations = [accountLocation, ...storedRecentLocations]
      }
      const next = {
        ...legacy,
        ...(stored ?? {}),
        recentBirthDetails: stored?.recentBirthDetails ?? legacy.recentBirthDetails,
        recentLocations,
        defaultLocation: stored?.defaultLocation ?? accountLocation ?? undefined,
        cachedSchedule: stored?.cachedSchedule ?? legacy.cachedSchedule,
        // Daily Guide is newly vault-owned. It has no predecessor in
        // clear-text browser storage, so only an already-encrypted value can
        // populate it.
        cachedDailyGuide: stored?.cachedDailyGuide,
        sessionSchedule: stored?.sessionSchedule ?? legacy.sessionSchedule,
        liveScheduleSeed: stored?.liveScheduleSeed ?? legacy.liveScheduleSeed,
        derivedIdentitySeed: stored?.derivedIdentitySeed ?? legacy.derivedIdentitySeed,
        selectedBird: stored?.selectedBird ?? legacy.selectedBird
      } satisfies LocalVaultData
      const accountLocationIncludedInVault = Boolean(
        accountLocation &&
          (sameLocation(next.defaultLocation, accountLocation) ||
            next.recentLocations?.some((location) => sameLocation(location, accountLocation)))
      )

      // Creating an empty encrypted payload makes "Create vault" durable even
      // before the user saves a calculator value. For an existing vault, avoid
      // rewriting identical ciphertext on every tab unlock: that would make
      // already-unlocked tabs mistake normal unlock activity for a vault edit.
      // Persist only when creating the vault or migrating remaining legacy data.
      const shouldPersist =
        !alreadyEncrypted ||
        hasLegacySensitiveStorage() ||
        Boolean(
          accountLocation &&
            (!stored?.defaultLocation ||
              (!sameLocation(stored.defaultLocation, accountLocation) &&
                !storedRecentLocations.some((location) => sameLocation(location, accountLocation))))
        )
      if (shouldPersist) {
        if (!(await commit(nextKey, next, canCommit))) return false
      } else {
        if (!canCommit()) return false
        dataRef.current = next
        setData(next)
        setHasEncryptedData(true)
      }
      if (!canCommit()) return false
      clearLegacySensitiveStorage()
      let accountLocationMigrationPending = legacyAccountLocation.pending ||
        (legacyAccountLocation.invalidLegacyLocation ?? false)
      if (accountLocation && accountLocationIncludedInVault) {
        accountLocationMigrationPending = !legacyAccountLocation.revision ||
          !(await clearMigratedLegacyAccountLocation(legacyAccountLocation.revision))
      }
      if (!canCommit()) return false
      legacyMigrationStatusVersionRef.current += 1
      setLegacyMigrationPending(accountLocationMigrationPending)
      setInvalidLegacyAccountLocation(legacyAccountLocation.invalidLegacyLocation ?? false)
      setLegacyAccountLocationRevision(
        legacyAccountLocation.invalidLegacyLocation ? legacyAccountLocation.revision ?? null : null,
      )
      if (!alreadyEncrypted) {
        setVaultBackupRecommended(true)
        setBackupRecommended(true)
      }
      setActiveVaultKey(nextKey)
      setKey(nextKey)
      setSessionVersion(version => version + 1)
      return true
    },
    [commit, legacyData]
  )

  const update = useCallback(
    async (updater: (current: LocalVaultData) => LocalVaultData) => {
      if (!key) throw new Error('Unlock the private data vault before saving.')
      const sessionEpoch = sessionEpochRef.current
      const operation = writeQueueRef.current.then(async () => {
        // A lock invalidates work that was waiting behind an earlier vault
        // write. It must neither write stale values nor repopulate this tab's
        // in-memory data after the user has explicitly locked it.
        if (sessionEpoch !== sessionEpochRef.current || activeVaultKey() !== key) return
        const next = updater(dataRef.current)
        const isCurrent = () => sessionEpoch === sessionEpochRef.current && activeVaultKey() === key
        const written = await writeVault(key, next, isCurrent)
        if (!written || !isCurrent()) return
        dataRef.current = next
        setData(next)
        setHasEncryptedData(true)
      })
      writeQueueRef.current = operation.catch(() => undefined)
      await operation
    },
    [key]
  )

  const clearEphemeralData = useCallback(async () => {
    if (!key) throw new Error('Unlock the private data vault before clearing history.')
    await update((current) => ({
      ...current,
      recentBirthDetails: undefined,
      recentLocations: undefined,
      cachedSchedule: undefined,
      cachedDailyGuide: undefined,
      sessionSchedule: undefined,
      liveScheduleSeed: undefined,
      derivedIdentitySeed: undefined,
    }))
  }, [key, update])

  const clear = useCallback(() => {
    announceVaultLock()
    sessionEpochRef.current += 1
    clearEphemeralDerivedIdentitySeed()
    clearVault()
    clearLegacySensitiveStorage()
    dataRef.current = {}
    setData({})
    setKey(null)
    setActiveVaultKey(null)
    setHasEncryptedData(false)
    legacyMigrationStatusVersionRef.current += 1
    setInvalidLegacyAccountLocation(false)
    setLegacyAccountLocationRevision(null)
    const statusVersion = legacyMigrationStatusVersionRef.current
    const localMigrationPending = hasLegacySensitiveStorage()
    setLegacyMigrationPending(localMigrationPending)
    void hasLegacyAccountLocationPending().then((accountLocationPending) => {
      if (legacyMigrationStatusVersionRef.current === statusVersion) {
        setLegacyMigrationPending(localMigrationPending || accountLocationPending)
      }
    })
    setBackupRecommended(false)
    setSessionVersion(version => version + 1)
  }, [])

  const discardInvalidLegacyLocation = useCallback(async () => {
    if (!key || !invalidLegacyAccountLocation || !legacyAccountLocationRevision) return false
    const cleared = await discardInvalidLegacyAccountLocationOnServer(legacyAccountLocationRevision)
    if (!cleared) return false
    const statusVersion = ++legacyMigrationStatusVersionRef.current
    setInvalidLegacyAccountLocation(false)
    setLegacyAccountLocationRevision(null)
    const accountLocationPending = await hasLegacyAccountLocationPending()
    if (legacyMigrationStatusVersionRef.current !== statusVersion) return false
    const pending = hasLegacySensitiveStorage() || accountLocationPending
    setLegacyMigrationPending(pending)
    return !pending
  }, [invalidLegacyAccountLocation, key, legacyAccountLocationRevision])

  const rotatePassphrase = useCallback(
    async (passphrase: string) => {
      if (!key) return false
      const sessionEpoch = sessionEpochRef.current
      const vaultKey = key
      const operation = writeQueueRef.current.then(async () => {
        if (sessionEpoch !== sessionEpochRef.current || activeVaultKey() !== vaultKey) return false
        const replacementKey = await applyVaultPassphraseRotation(
          passphrase,
          dataRef.current,
          () => sessionEpoch === sessionEpochRef.current && activeVaultKey() === vaultKey
        )
        if (!replacementKey) return false
        setActiveVaultKey(replacementKey)
        setKey(replacementKey)
        setVaultBackupRecommended(true)
        setBackupRecommended(true)
        return true
      })
      writeQueueRef.current = operation.then(
        () => undefined,
        () => undefined
      )
      return operation
    },
    [key]
  )

  const lock = useCallback(() => {
    // Retain only authenticated ciphertext in browser storage. Remounting the
    // child tree drops private values held in individual calculator forms.
    announceVaultLock()
    sessionEpochRef.current += 1
    clearEphemeralDerivedIdentitySeed()
    dataRef.current = {}
    setData({})
    setKey(null)
    setActiveVaultKey(null)
    setInvalidLegacyAccountLocation(false)
    setLegacyAccountLocationRevision(null)
    setHasEncryptedData(hasVault())
    setInvalidLegacyAccountLocation(false)
    setLegacyAccountLocationRevision(null)
    setSessionVersion(version => version + 1)
  }, [])

  const exportBackup = useCallback(() => {
    const backup = exportVaultBackup()
    if (backup) {
      setVaultBackupRecommended(false)
      setBackupRecommended(false)
    }
    return backup
  }, [])

  const importBackup = useCallback((serialized: string): VaultBackupImportResult => {
    const result = importVaultBackup(serialized)
    if (result !== 'imported') return result
    // Imported ciphertext is intentionally locked. Do not retain a key or
    // prior in-memory data from this tab, and do not preserve legacy cleartext.
    clearLegacySensitiveStorage()
    sessionEpochRef.current += 1
    clearEphemeralDerivedIdentitySeed()
    dataRef.current = {}
    setData({})
    setKey(null)
    setActiveVaultKey(null)
    setHasEncryptedData(true)
    legacyMigrationStatusVersionRef.current += 1
    setInvalidLegacyAccountLocation(false)
    setLegacyAccountLocationRevision(null)
    const statusVersion = legacyMigrationStatusVersionRef.current
    void hasLegacyAccountLocationPending().then((accountLocationPending) => {
      if (legacyMigrationStatusVersionRef.current === statusVersion) {
        setLegacyMigrationPending(hasLegacySensitiveStorage() || accountLocationPending)
      }
    })
    setVaultBackupRecommended(false)
    setBackupRecommended(false)
    return result
  }, [])

  const value = useMemo(
    () => ({
      data,
      ready,
      unlocked: key !== null,
      hasEncryptedData,
      legacyMigrationPending,
      invalidLegacyAccountLocation,
      backupRecommended,
      unlock,
      lock,
      update,
      clearEphemeralData,
      rotatePassphrase,
      exportBackup,
      importBackup,
      discardInvalidLegacyAccountLocation: discardInvalidLegacyLocation,
      clear
    }),
    [
      backupRecommended,
      clear,
      data,
      exportBackup,
      hasEncryptedData,
      invalidLegacyAccountLocation,
      importBackup,
      discardInvalidLegacyLocation,
      key,
      legacyMigrationPending,
      lock,
      ready,
      rotatePassphrase,
      unlock,
      update,
      clearEphemeralData,
    ]
  )
  return (
    <LocalVaultContext.Provider value={value}>
      <Fragment key={sessionVersion}>{children}</Fragment>
    </LocalVaultContext.Provider>
  )
}

export function useLocalVault(): VaultContextValue {
  const value = useContext(LocalVaultContext)
  if (!value) throw new Error('useLocalVault must be used inside LocalVaultProvider.')
  return value
}

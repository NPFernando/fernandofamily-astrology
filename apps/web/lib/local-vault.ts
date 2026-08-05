"use client";

// Browser storage is readable by anyone with access to this browser profile.
// Sensitive calculator inputs therefore go through this small AES-GCM vault;
// the passphrase-derived key is deliberately held only in memory.
const SALT_KEY = "ff_private_vault_salt_v1";
const VAULT_KEY = "ff_private_vault_v1";
const ROTATION_KEY = "ff_private_vault_rotation_v1";
const ITERATIONS = 310_000;

// Module state is scoped to the current browser tab. It survives React layout
// remounts (such as an /en -> /si navigation) without ever being serialized.
let activeKey: CryptoKey | null = null;

// These keys predate the vault. They are read once during successful vault
// creation/unlock, encrypted as part of the vault payload, and then removed.
// Keeping the list here makes the privacy clear action use the exact same
// boundary as migration.
export const LEGACY_SENSITIVE_LOCAL_STORAGE_KEYS = [
  "ff_recent_birth_details",
  "ff_recent_locations",
  "ff_last_schedule_cache",
  "ff_selected_bird",
] as const;

export const LEGACY_SENSITIVE_SESSION_STORAGE_KEYS = [
  "ff_session_schedule",
  "ff_live_schedule_seed",
  "ff_derived_identity_seed",
] as const;

type EncryptedPayload = {
  version: 1;
  iv: string;
  ciphertext: string;
};

type VaultStorage = {
  salt: string;
  payload: EncryptedPayload;
};

type VaultRotationJournal = {
  version: 1;
  previous: VaultStorage;
  next: VaultStorage;
};

export type PreparedVaultPassphraseRotation = {
  key: CryptoKey;
  next: VaultStorage;
};

export type VaultBackup = {
  format: "fernandofamily-private-vault";
  version: 1;
  exportedAt: string;
  salt: string;
  payload: EncryptedPayload;
};

export type VaultBackupImportResult = "imported" | "existing_vault" | "invalid_backup";

function toBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function validBase64(value: unknown, expectedLength?: number): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    const decoded = fromBase64(value);
    return expectedLength === undefined ? decoded.byteLength > 0 : decoded.byteLength === expectedLength;
  } catch {
    return false;
  }
}

function parseEncryptedPayload(value: unknown): EncryptedPayload | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<EncryptedPayload>;
  if (payload.version !== 1 || !validBase64(payload.iv, 12) || !validBase64(payload.ciphertext)) return null;
  return { version: 1, iv: payload.iv, ciphertext: payload.ciphertext };
}

function parseVaultStorage(value: unknown): VaultStorage | null {
  if (!value || typeof value !== "object") return null;
  const storage = value as Partial<VaultStorage>;
  if (!validBase64(storage.salt, 16)) return null;
  const payload = parseEncryptedPayload(storage.payload);
  return payload ? { salt: storage.salt, payload } : null;
}

function parseVaultRotationJournal(value: unknown): VaultRotationJournal | null {
  if (!value || typeof value !== "object") return null;
  const journal = value as Partial<VaultRotationJournal>;
  if (journal.version !== 1) return null;
  const previous = parseVaultStorage(journal.previous);
  const next = parseVaultStorage(journal.next);
  return previous && next ? { version: 1, previous, next } : null;
}

function parseVaultBackup(value: unknown): VaultBackup | null {
  if (!value || typeof value !== "object") return null;
  const backup = value as Partial<VaultBackup>;
  if (
    backup.format !== "fernandofamily-private-vault" ||
    backup.version !== 1 ||
    typeof backup.exportedAt !== "string" ||
    Number.isNaN(Date.parse(backup.exportedAt)) ||
    !validBase64(backup.salt, 16)
  ) {
    return null;
  }
  const payload = parseEncryptedPayload(backup.payload);
  return payload ? { format: backup.format, version: 1, exportedAt: backup.exportedAt, salt: backup.salt, payload } : null;
}

function asBufferSource(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function vaultSalt(): Uint8Array {
  recoverPendingVaultRotation();
  const existing = window.localStorage.getItem(SALT_KEY);
  if (existing) return fromBase64(existing);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  window.localStorage.setItem(SALT_KEY, toBase64(salt));
  return salt;
}

async function deriveVaultKeyForSalt(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!passphrase.trim()) throw new Error("A vault passphrase is required.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBufferSource(salt), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function deriveVaultKey(passphrase: string): Promise<CryptoKey> {
  return deriveVaultKeyForSalt(passphrase, vaultSalt());
}

async function encryptVaultPayload(key: CryptoKey, value: unknown): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    plaintext,
  );
  return {
    version: 1,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

function currentVaultStorage(): VaultStorage | null {
  const salt = window.localStorage.getItem(SALT_KEY);
  const rawPayload = window.localStorage.getItem(VAULT_KEY);
  if (!validBase64(salt, 16) || !rawPayload) return null;
  try {
    const payload = parseEncryptedPayload(JSON.parse(rawPayload));
    return payload ? { salt, payload } : null;
  } catch {
    return null;
  }
}

function sameVaultStorage(left: VaultStorage, right: VaultStorage): boolean {
  return left.salt === right.salt && JSON.stringify(left.payload) === JSON.stringify(right.payload);
}

// localStorage does not offer a multi-key transaction. The small journal lets
// the next vault operation restore the last authenticated pair if a tab closes
// between writing the new salt and ciphertext.
function recoverPendingVaultRotation(): void {
  if (typeof window === "undefined") return;
  const rawJournal = window.localStorage.getItem(ROTATION_KEY);
  if (!rawJournal) return;
  try {
    const journal = parseVaultRotationJournal(JSON.parse(rawJournal));
    if (!journal) throw new Error("Invalid vault rotation journal.");
    const current = currentVaultStorage();
    if (!current || !sameVaultStorage(current, journal.next)) {
      window.localStorage.setItem(SALT_KEY, journal.previous.salt);
      window.localStorage.setItem(VAULT_KEY, JSON.stringify(journal.previous.payload));
    }
  } finally {
    window.localStorage.removeItem(ROTATION_KEY);
  }
}

export async function readVault<T>(key: CryptoKey): Promise<T | null> {
  recoverPendingVaultRotation();
  const raw = window.localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  try {
    const encrypted = JSON.parse(raw) as EncryptedPayload;
    if (encrypted.version !== 1) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBufferSource(fromBase64(encrypted.iv)) },
      key,
      asBufferSource(fromBase64(encrypted.ciphertext)),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    // A wrong passphrase and a damaged ciphertext are intentionally
    // indistinguishable to callers.
    return null;
  }
}

export async function writeVault(key: CryptoKey, value: unknown): Promise<void> {
  recoverPendingVaultRotation();
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(await encryptVaultPayload(key, value)));
}

export function hasVault(): boolean {
  if (typeof window === "undefined") return false;
  recoverPendingVaultRotation();
  return window.localStorage.getItem(VAULT_KEY) !== null;
}

export function activeVaultKey(): CryptoKey | null {
  return activeKey;
}

export function setActiveVaultKey(key: CryptoKey | null): void {
  activeKey = key;
}

export function clearVault(): void {
  window.localStorage.removeItem(VAULT_KEY);
  window.localStorage.removeItem(SALT_KEY);
  window.localStorage.removeItem(ROTATION_KEY);
  activeKey = null;
}

// Prepare first, then apply synchronously. A caller can still abort after the
// expensive KDF work (for example because the user locked the vault), without
// changing browser storage.
export async function prepareVaultPassphraseRotation(
  value: unknown,
  passphrase: string,
): Promise<PreparedVaultPassphraseRotation> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKeyForSalt(passphrase, saltBytes);
  return {
    key,
    next: {
      salt: toBase64(saltBytes),
      payload: await encryptVaultPayload(key, value),
    },
  };
}

// Returns false without changing the unlocked key when browser storage cannot
// safely stage the rotation. A leftover journal is recovered to the previous
// ciphertext pair before the result is returned.
export function applyVaultPassphraseRotation(rotation: PreparedVaultPassphraseRotation): boolean {
  recoverPendingVaultRotation();
  const previous = currentVaultStorage();
  if (!previous) return false;
  try {
    const journal: VaultRotationJournal = { version: 1, previous, next: rotation.next };
    window.localStorage.setItem(ROTATION_KEY, JSON.stringify(journal));
    window.localStorage.setItem(SALT_KEY, rotation.next.salt);
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(rotation.next.payload));
    window.localStorage.removeItem(ROTATION_KEY);
    return true;
  } catch {
    recoverPendingVaultRotation();
    return false;
  }
}

// A backup intentionally copies only authenticated ciphertext and its KDF
// salt. It never decrypts the vault, includes no passphrase, and is portable
// only for someone who knows the original passphrase.
export function exportVaultBackup(): VaultBackup | null {
  recoverPendingVaultRotation();
  const storage = currentVaultStorage();
  if (!storage) return null;
  return {
    format: "fernandofamily-private-vault",
    version: 1,
    exportedAt: new Date().toISOString(),
    salt: storage.salt,
    payload: storage.payload,
  };
}

// Import is intentionally fail-closed: a device with a vault must be cleared
// first, so an uploaded file can never silently replace private local data.
export function importVaultBackup(serialized: string): VaultBackupImportResult {
  recoverPendingVaultRotation();
  if (hasVault()) return "existing_vault";
  try {
    const backup = parseVaultBackup(JSON.parse(serialized));
    if (!backup) return "invalid_backup";
    window.localStorage.setItem(SALT_KEY, backup.salt);
    window.localStorage.setItem(VAULT_KEY, JSON.stringify(backup.payload));
    window.localStorage.removeItem(ROTATION_KEY);
    activeKey = null;
    return "imported";
  } catch {
    // No existing vault was present before this operation, so a failed write
    // must leave no partial salt/ciphertext pair behind.
    window.localStorage.removeItem(SALT_KEY);
    window.localStorage.removeItem(VAULT_KEY);
    return "invalid_backup";
  }
}

export function clearLegacySensitiveStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_SENSITIVE_LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
  for (const key of LEGACY_SENSITIVE_SESSION_STORAGE_KEYS) window.sessionStorage.removeItem(key);
}

"use client";

// Browser storage is readable by anyone with access to this browser profile.
// Sensitive calculator inputs therefore go through this small AES-GCM vault;
// the passphrase-derived key is deliberately held only in memory.
const SALT_KEY = "ff_private_vault_salt_v1";
const VAULT_KEY = "ff_private_vault_v1";
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

function toBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function asBufferSource(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

function vaultSalt(): Uint8Array {
  const existing = window.localStorage.getItem(SALT_KEY);
  if (existing) return fromBase64(existing);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  window.localStorage.setItem(SALT_KEY, toBase64(salt));
  return salt;
}

export async function deriveVaultKey(passphrase: string): Promise<CryptoKey> {
  if (!passphrase.trim()) throw new Error("A vault passphrase is required.");
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBufferSource(vaultSalt()), iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function readVault<T>(key: CryptoKey): Promise<T | null> {
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
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBufferSource(iv) },
    key,
    plaintext,
  );
  const encrypted: EncryptedPayload = {
    version: 1,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(encrypted));
}

export function hasVault(): boolean {
  return typeof window !== "undefined" && window.localStorage.getItem(VAULT_KEY) !== null;
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
  activeKey = null;
}

export function clearLegacySensitiveStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_SENSITIVE_LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
  for (const key of LEGACY_SENSITIVE_SESSION_STORAGE_KEYS) window.sessionStorage.removeItem(key);
}

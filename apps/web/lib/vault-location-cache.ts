export type VaultLocation = { name: string; latitude: number; longitude: number; iana_tz: string };

let recentLocation: VaultLocation | null = null;

export function mostRecentVaultLocation(): VaultLocation | null {
  return recentLocation;
}

export function setMostRecentVaultLocation(value: VaultLocation | null): void {
  recentLocation = value;
}

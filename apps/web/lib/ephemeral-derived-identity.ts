import type { BirdId, PakshaId } from '@/lib/api-client'

export type DerivedIdentitySeed = {
  bird: BirdId
  nakshatra_index: number | null
  paksha: PakshaId | null
  moon_rashi_index: number | null
  savedAtIso: string
}

let seed: DerivedIdentitySeed | null = null

export function setEphemeralDerivedIdentitySeed(value: DerivedIdentitySeed): void {
  seed = value
}

export function getEphemeralDerivedIdentitySeed(): DerivedIdentitySeed | null {
  return seed
}

export function clearEphemeralDerivedIdentitySeed(): void {
  seed = null
}

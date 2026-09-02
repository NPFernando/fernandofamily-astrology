"use client";

import {
  fetchScheduleWithServerTime,
  type BirdId,
  type PakshaId,
  type ScheduleRequest,
  type ScheduleResponse,
} from "@/lib/api-client";
import { loadAccountPreferences } from "@/lib/account-preferences";
import { activeProfileId, listLocalProfiles } from "@/lib/profiles";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";

export type CachedSchedule = { schedule: ScheduleResponse; cachedAtIso: string };
export type SessionSchedule = { schedule: ScheduleResponse; serverTimeIso: string | null; fetchedAtClientMs: number };
export type LiveScheduleSeed = SessionSchedule & { request: ScheduleRequest };
export type DerivedIdentitySeed = {
  bird: BirdId;
  nakshatra_index: number | null;
  paksha: PakshaId | null;
  moon_rashi_index: number | null;
  savedAtIso: string;
};

// A derived bird/nakshatra result is not raw birth data or a precise
// location. Preserve the existing same-tab quick-action flow while locked,
// but never serialize it outside the encrypted vault.
let ephemeralDerivedIdentitySeed: DerivedIdentitySeed | null = null;

export type VaultLocation = {
  name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
};

export function cachedScheduleFor(schedule: ScheduleResponse): CachedSchedule {
  return { schedule, cachedAtIso: new Date().toISOString() };
}

export function sessionScheduleFor(
  schedule: ScheduleResponse,
  serverTime: Date | null,
  fetchedAtClientMs: number,
): SessionSchedule {
  return {
    schedule,
    serverTimeIso: serverTime ? serverTime.toISOString() : null,
    fetchedAtClientMs,
  };
}

export function liveScheduleSeedFor(
  schedule: ScheduleResponse,
  serverTime: Date | null,
  fetchedAtClientMs: number,
): LiveScheduleSeed {
  return {
    ...sessionScheduleFor(schedule, serverTime, fetchedAtClientMs),
    request: requestFromSchedule(schedule),
  };
}

export function derivedIdentitySeedFor(
  seed: Omit<DerivedIdentitySeed, "savedAtIso">,
): DerivedIdentitySeed {
  return { ...seed, savedAtIso: new Date().toISOString() };
}

export function setEphemeralDerivedIdentitySeed(seed: DerivedIdentitySeed): void {
  ephemeralDerivedIdentitySeed = seed;
}

export function clearEphemeralDerivedIdentitySeed(): void {
  ephemeralDerivedIdentitySeed = null;
}

export function requestFromSchedule(schedule: ScheduleResponse): ScheduleRequest {
  const target = nowAsTargetDateTime(schedule.location.iana_tz);
  return {
    method: "bird",
    bird: schedule.birth_bird,
    target_date: target.date,
    target_time: target.time,
    location_name: schedule.location.name,
    latitude: schedule.location.latitude,
    longitude: schedule.location.longitude,
    iana_tz: schedule.location.iana_tz,
  };
}

export async function resolveDefaultScheduleRequest({
  recentLocation,
  derivedIdentitySeed,
  selectedBird,
}: {
  recentLocation?: VaultLocation | null;
  derivedIdentitySeed?: DerivedIdentitySeed | null;
  selectedBird?: BirdId | null;
} = {}): Promise<ScheduleRequest> {
  const account = await loadAccountPreferences();
  const localProfiles = listLocalProfiles();
  // A profile selected explicitly in this tab beats the old "newest" rule.
  // This is derived-only state and intentionally never unlocks or supplies
  // birth date, time, or exact location.
  const active = localProfiles.find((profile) => profile.id === activeProfileId());
  const newest = active ?? localProfiles[localProfiles.length - 1];
  const location = account.preferences?.default_location ?? recentLocation ?? {
    name: "Colombo, Sri Lanka",
    latitude: 6.9271,
    longitude: 79.8612,
    iana_tz: "Asia/Colombo",
  };
  const target = nowAsTargetDateTime(location.iana_tz);
  const base = {
    target_date: target.date,
    target_time: target.time,
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
  };

  const identitySeed = derivedIdentitySeed ?? ephemeralDerivedIdentitySeed;

  if (identitySeed?.nakshatra_index && identitySeed.paksha) {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: identitySeed.nakshatra_index,
      paksha: identitySeed.paksha,
      moon_rashi_index: identitySeed.moon_rashi_index ?? null,
    };
  }
  if (identitySeed?.bird) {
    return { ...base, method: "bird", bird: identitySeed.bird };
  }
  if (active?.bird) {
    return { ...base, method: "bird", bird: active.bird };
  }
  if (active?.nakshatra_index && active?.paksha) {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: active.nakshatra_index,
      paksha: active.paksha,
      moon_rashi_index: active.moon_rashi_index ?? null,
    };
  }
  if (account.preferences?.default_bird) {
    return { ...base, method: "bird", bird: account.preferences.default_bird };
  }
  if (newest?.bird) {
    return { ...base, method: "bird", bird: newest.bird };
  }
  if (newest?.nakshatra_index && newest?.paksha) {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: newest.nakshatra_index,
      paksha: newest.paksha,
      moon_rashi_index: newest.moon_rashi_index ?? null,
    };
  }
  return { ...base, method: "bird", bird: selectedBird ?? "peacock" };
}

export async function fetchLiveSchedule(request: ScheduleRequest) {
  let { data, serverTime } = await fetchScheduleWithServerTime(request);
  let fetchedAtClientMs = Date.now();
  const referenceNow = serverTime ? serverTime.getTime() : fetchedAtClientMs;
  if (data.current_period === null && new Date(data.next_sunrise).getTime() <= referenceNow) {
    // Roll forward in the REQUEST'S location timezone, not the browser's —
    // a wall-tablet (or a schedule for a different city) whose system clock
    // is in a different zone would otherwise compute "today" from the wrong
    // calendar day around midnight, showing a stale/wrong period until the
    // next natural refetch corrected it.
    const target = nowAsTargetDateTime(request.iana_tz, new Date(referenceNow));
    const rolled: ScheduleRequest = {
      ...request,
      target_date: target.date,
      target_time: target.time,
    };
    ({ data, serverTime } = await fetchScheduleWithServerTime(rolled));
    fetchedAtClientMs = Date.now();
    return { data, serverTime, fetchedAtClientMs, request: rolled };
  }

  return { data, serverTime, fetchedAtClientMs, request };
}

"use client";

import {
  fetchScheduleWithServerTime,
  type BirdId,
  type ScheduleRequest,
  type ScheduleResponse,
} from "@/lib/api-client";
import { loadAccountPreferences } from "@/lib/account-preferences";
import { listLocalProfiles } from "@/lib/profiles";
import { DEFAULT_LOCATION, mostRecentLocation } from "@/components/pancha-pakshi/LocationPicker";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";

const SCHEDULE_CACHE_KEY = "ff_last_schedule_cache";
const SESSION_SCHEDULE_KEY = "ff_session_schedule";
const LIVE_SEED_KEY = "ff_live_schedule_seed";

export type CachedSchedule = { schedule: ScheduleResponse; cachedAtIso: string };
export type SessionSchedule = { schedule: ScheduleResponse; serverTimeIso: string | null; fetchedAtClientMs: number };
export type LiveScheduleSeed = SessionSchedule & { request: ScheduleRequest };

export function loadCachedSchedule(): CachedSchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SCHEDULE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedSchedule) : null;
  } catch {
    return null;
  }
}

export function saveCachedSchedule(schedule: ScheduleResponse) {
  window.localStorage.setItem(
    SCHEDULE_CACHE_KEY,
    JSON.stringify({ schedule, cachedAtIso: new Date().toISOString() } satisfies CachedSchedule),
  );
}

// Separate from the localStorage PWA offline cache above: this survives a
// client-side route change within the same browser tab (e.g. switching
// language, which navigates from /en/pancha-pakshi to /si/pancha-pakshi and
// remounts this page under the new [locale] segment, wiping normal React
// state) but not a new tab/session. Holds only the computed schedule response,
// never the birth-data request that produced it.
export function loadSessionSchedule(): SessionSchedule | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_SCHEDULE_KEY);
    return raw ? (JSON.parse(raw) as SessionSchedule) : null;
  } catch {
    return null;
  }
}

export function saveSessionSchedule(schedule: ScheduleResponse, serverTime: Date | null, fetchedAtClientMs: number) {
  window.sessionStorage.setItem(
    SESSION_SCHEDULE_KEY,
    JSON.stringify({
      schedule,
      serverTimeIso: serverTime ? serverTime.toISOString() : null,
      fetchedAtClientMs,
    } satisfies SessionSchedule),
  );
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

export function loadLiveSeed(): LiveScheduleSeed | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LIVE_SEED_KEY);
    return raw ? (JSON.parse(raw) as LiveScheduleSeed) : null;
  } catch {
    return null;
  }
}

export function saveLiveSeed(schedule: ScheduleResponse, serverTime: Date | null, fetchedAtClientMs: number) {
  window.sessionStorage.setItem(
    LIVE_SEED_KEY,
    JSON.stringify({
      schedule,
      request: requestFromSchedule(schedule),
      serverTimeIso: serverTime ? serverTime.toISOString() : null,
      fetchedAtClientMs,
    } satisfies LiveScheduleSeed),
  );
}

export async function resolveDefaultScheduleRequest(): Promise<ScheduleRequest> {
  const account = await loadAccountPreferences();
  const localProfiles = listLocalProfiles();
  const newest = localProfiles[localProfiles.length - 1];
  const storedBird = window.localStorage.getItem("ff_selected_bird") as BirdId | null;
  const location = account.preferences?.default_location ?? mostRecentLocation() ?? DEFAULT_LOCATION;
  const target = nowAsTargetDateTime(location.iana_tz);
  const base = {
    target_date: target.date,
    target_time: target.time,
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
  };

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
    };
  }
  return { ...base, method: "bird", bird: storedBird ?? "peacock" };
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

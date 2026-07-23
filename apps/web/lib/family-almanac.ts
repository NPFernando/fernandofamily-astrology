import type {
  EffectId,
  MuhurtaGrade,
  MuhurtaSearchRequest,
  MuhurtaWindow,
  ScheduleRequest,
  ScheduleResponse,
  SubPeriod,
} from "@/lib/api-client";
import type { SavedProfile } from "@/lib/profiles";
import { nowAsTargetDateTime } from "@/components/pancha-pakshi/TargetDateTimeFields";
import type { LocationValue } from "@/components/pancha-pakshi/LocationPicker";

export const FAMILY_ALMANAC_DAYS = 7;
export const FAMILY_ALMANAC_PROFILE_LIMIT = 4;
export const FAMILY_ALMANAC_MIN_SHARED_SECONDS = 900;

export const EFFECT_RANK: Record<EffectId, number> = {
  very_good: 0,
  good: 1,
  average: 2,
  bad: 3,
  very_bad: 4,
};

export const MUHURTA_GRADE_RANK: Record<MuhurtaGrade, number> = {
  excellent: 0,
  good: 1,
  usable: 2,
};

export type FamilyMuhurtaResult = {
  profile: SavedProfile;
  windows: MuhurtaWindow[];
  failed: boolean;
};

export type SharedFamilyWindow = {
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  grade: MuhurtaGrade;
  average_score: number;
  windows: MuhurtaWindow[];
};

export type IndividualFamilyWindow = {
  profile: SavedProfile;
  window: MuhurtaWindow;
};

export function validDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayFor(location: LocationValue): { date: string; time: string } {
  return nowAsTargetDateTime(location.iana_tz);
}

export function targetTimeFor(date: string, location: LocationValue): string {
  const nowThere = todayFor(location);
  return date === nowThere.date ? nowThere.time : "12:00:00";
}

export function locationFromRequest(request: ScheduleRequest): LocationValue {
  return {
    name: request.location_name,
    latitude: request.latitude,
    longitude: request.longitude,
    iana_tz: request.iana_tz,
  };
}

export function withDateLocation(
  request: ScheduleRequest,
  date: string,
  location: LocationValue,
): ScheduleRequest {
  const base = {
    target_date: date,
    target_time: targetTimeFor(date, location),
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
  };
  if (request.method === "nakshatra_paksha") {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: request.nakshatra_index,
      paksha: request.paksha,
      moon_rashi_index: request.moon_rashi_index ?? null,
    };
  }
  if (request.method === "birth_datetime") {
    return {
      ...base,
      method: "birth_datetime",
      birth_date: request.birth_date,
      birth_time: request.birth_time,
    };
  }
  return { ...base, method: "bird", bird: request.bird };
}

export function scheduleRequestFromProfile(
  profile: SavedProfile,
  date: string,
  location: LocationValue,
): ScheduleRequest | null {
  const base = {
    target_date: date,
    target_time: targetTimeFor(date, location),
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
  };
  if (profile.bird) return { ...base, method: "bird", bird: profile.bird };
  if (profile.nakshatra_index != null && profile.paksha) {
    return {
      ...base,
      method: "nakshatra_paksha",
      nakshatra_index: profile.nakshatra_index,
      paksha: profile.paksha,
      moon_rashi_index: profile.moon_rashi_index ?? null,
    };
  }
  return null;
}

export function muhurtaRequestFromProfile(
  profile: SavedProfile,
  date: string,
  location: LocationValue,
): MuhurtaSearchRequest | null {
  const base = {
    from_date: date,
    days: FAMILY_ALMANAC_DAYS,
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    iana_tz: location.iana_tz,
    purpose: "general" as const,
    min_effect: "good" as const,
    min_duration_seconds: FAMILY_ALMANAC_MIN_SHARED_SECONDS,
  };
  if (profile.bird) return { ...base, method: "bird" as const, bird: profile.bird };
  if (profile.nakshatra_index != null && profile.paksha) {
    return {
      ...base,
      method: "nakshatra_paksha" as const,
      nakshatra_index: profile.nakshatra_index,
      paksha: profile.paksha,
    };
  }
  return null;
}

export function bestPanchaWindows(schedule: ScheduleResponse, limit = 5): SubPeriod[] {
  return schedule.major_periods
    .flatMap((major) => major.sub_periods)
    .filter((period) => period.effect === "good" || period.effect === "very_good")
    .sort((a, b) => {
      const effectRank = EFFECT_RANK[a.effect] - EFFECT_RANK[b.effect];
      if (effectRank !== 0) return effectRank;
      if (a.rating !== b.rating) return b.rating - a.rating;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    })
    .slice(0, limit);
}

export function bestMuhurtaWindow(windows: MuhurtaWindow[]): MuhurtaWindow | null {
  return [...windows].sort((a, b) => {
    const grade = MUHURTA_GRADE_RANK[a.grade] - MUHURTA_GRADE_RANK[b.grade];
    if (grade !== 0) return grade;
    if (a.score !== b.score) return b.score - a.score;
    if (a.duration_seconds !== b.duration_seconds) return b.duration_seconds - a.duration_seconds;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  })[0] ?? null;
}

function overlapWindow(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): { starts_at: string; ends_at: string; duration_seconds: number } | null {
  const startMs = Math.max(new Date(aStart).getTime(), new Date(bStart).getTime());
  const endMs = Math.min(new Date(aEnd).getTime(), new Date(bEnd).getTime());
  const durationSeconds = Math.floor((endMs - startMs) / 1000);
  if (durationSeconds < FAMILY_ALMANAC_MIN_SHARED_SECONDS) return null;
  return {
    starts_at: new Date(startMs).toISOString(),
    ends_at: new Date(endMs).toISOString(),
    duration_seconds: durationSeconds,
  };
}

export function sharedWindowsForDay(
  results: FamilyMuhurtaResult[],
  date: string,
): SharedFamilyWindow[] {
  const usable = results
    .filter((result) => !result.failed)
    .map((result) => ({
      profile: result.profile,
      windows: result.windows.filter((window) => window.effective_date === date),
    }))
    .filter((result) => result.windows.length > 0);
  if (usable.length < 2 || usable.length !== results.length) return [];

  let candidates = usable[0].windows.map((window) => ({
    starts_at: window.starts_at,
    ends_at: window.ends_at,
    duration_seconds: window.duration_seconds,
    windows: [window],
  }));

  for (const result of usable.slice(1)) {
    const next = [];
    for (const candidate of candidates) {
      for (const window of result.windows) {
        const overlap = overlapWindow(candidate.starts_at, candidate.ends_at, window.starts_at, window.ends_at);
        if (overlap) next.push({ ...overlap, windows: [...candidate.windows, window] });
      }
    }
    candidates = next;
    if (candidates.length === 0) return [];
  }

  return candidates
    .map((candidate) => {
      const grade = candidate.windows.reduce<MuhurtaGrade>(
        (worst, window) =>
          MUHURTA_GRADE_RANK[window.grade] > MUHURTA_GRADE_RANK[worst] ? window.grade : worst,
        "excellent",
      );
      return {
        ...candidate,
        grade,
        average_score: candidate.windows.reduce((sum, window) => sum + window.score, 0) / candidate.windows.length,
      };
    })
    .sort((a, b) => {
      const grade = MUHURTA_GRADE_RANK[a.grade] - MUHURTA_GRADE_RANK[b.grade];
      if (grade !== 0) return grade;
      if (a.average_score !== b.average_score) return b.average_score - a.average_score;
      if (a.duration_seconds !== b.duration_seconds) return b.duration_seconds - a.duration_seconds;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    });
}

export function individualWindowsForDay(
  results: FamilyMuhurtaResult[],
  date: string,
): IndividualFamilyWindow[] {
  return results
    .filter((result) => !result.failed)
    .flatMap((result) => {
      const best = bestMuhurtaWindow(result.windows.filter((window) => window.effective_date === date));
      return best ? [{ profile: result.profile, window: best }] : [];
    })
    .sort((a, b) => {
      const grade = MUHURTA_GRADE_RANK[a.window.grade] - MUHURTA_GRADE_RANK[b.window.grade];
      if (grade !== 0) return grade;
      if (a.window.score !== b.window.score) return b.window.score - a.window.score;
      return new Date(a.window.starts_at).getTime() - new Date(b.window.starts_at).getTime();
    });
}

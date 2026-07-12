// Typed client for the Pancha Pakshi API. Mirrors
// apps/api/app/modules/pancha_pakshi/{requests,models}.py exactly — field
// names here must match the Pydantic models field-for-field.
//
// Every call that carries birth data or precise coordinates is a POST with a
// JSON body. Never build a URL by interpolating any of these fields — that's
// enforced by tests/no-birth-fields-in-url.test.ts.

const API_BASE = "/api/v1/pancha-pakshi";

export type BirdId = "vulture" | "owl" | "crow" | "cock" | "peacock";
export type ActivityId = "ruling" | "eating" | "walking" | "sleeping" | "dying";
export type PakshaId = "waxing" | "waning";
export type PeriodKind = "day" | "night";
export type RelationId = "enemy" | "same" | "friend";
export type EffectId = "very_bad" | "bad" | "average" | "good" | "very_good";
export type WeekdayId =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

type TargetAndLocation = {
  target_date: string; // YYYY-MM-DD
  target_time: string; // HH:mm:ss
  location_name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
  as_of_date?: string;
  as_of_time?: string;
};

export type BirthDateTimeInput = TargetAndLocation & {
  method: "birth_datetime";
  birth_date: string;
  birth_time: string;
};

export type NakshatraPakshaInput = TargetAndLocation & {
  method: "nakshatra_paksha";
  nakshatra_index: number;
  paksha: PakshaId;
};

export type BirdSelectionInput = TargetAndLocation & {
  method: "bird";
  bird: BirdId;
};

export type ScheduleRequest = BirthDateTimeInput | NakshatraPakshaInput | BirdSelectionInput;
export type BirthBirdRequest = BirthDateTimeInput | NakshatraPakshaInput;

export type BirthBirdResponse = {
  birth_bird: BirdId;
  padu_pakshi: BirdId;
  bharana_pakshi: BirdId;
};

export type EngineMetadata = {
  name: string;
  version: string;
  commit: string;
  csv_checksum: string;
  ephemeris_manifest_checksum: string;
  deployed_commit: string;
};

export type Location = {
  name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
  utc_offset_minutes: number;
};

export type SubPeriod = {
  id: string;
  kind: PeriodKind;
  major_index: number;
  sub_index: number;
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  main_bird: BirdId;
  main_activity: ActivityId;
  sub_bird: BirdId;
  sub_activity: ActivityId;
  relation: RelationId;
  power_factor: number;
  effect: EffectId;
  rating: number;
  is_current: boolean;
};

export type MajorPeriod = {
  index: number;
  kind: PeriodKind;
  main_bird: BirdId;
  main_activity: ActivityId;
  starts_at: string;
  ends_at: string;
  padu_pakshi: BirdId;
  bharana_pakshi: BirdId;
  sub_periods: SubPeriod[];
};

export type ScheduleResponse = {
  engine: EngineMetadata;
  location: Location;
  sunrise: string;
  sunset: string;
  next_sunrise: string;
  birth_bird: BirdId;
  paksha: PakshaId;
  weekday: WeekdayId;
  padu_pakshi: BirdId;
  bharana_pakshi: BirdId;
  current_period: SubPeriod | null;
  next_period: SubPeriod | null;
  major_periods: MajorPeriod[];
  summary: { major_period_count: number; sub_period_count: number };
};

export type CurrentResponse = {
  current_period: SubPeriod | null;
  next_period: SubPeriod | null;
};

// Multi-day auspicious-window search (week view). The request reuses the
// schedule request shape with target_date as the range start.
export type WindowsRequest = ScheduleRequest & {
  days: number;
  min_effect: "good" | "very_good";
};

export type WindowEntry = SubPeriod & { effective_date: string };

export type WindowsResponse = {
  engine: EngineMetadata;
  location: Location;
  birth_bird: BirdId;
  from_date: string;
  days: number;
  min_effect: "good" | "very_good";
  windows: WindowEntry[];
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const { data } = await postJsonWithMeta<TResponse>(path, body);
  return data;
}

// The response model has no "generated at" field of its own, so the HTTP
// `Date` response header stands in as the server-time reference for
// client/server clock-skew correction in the live countdown.
async function postJsonWithMeta<TResponse>(
  path: string,
  body: unknown,
): Promise<{ data: TResponse; serverTime: Date | null }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  const dateHeader = res.headers.get("date");
  return { data: data as TResponse, serverTime: dateHeader ? new Date(dateHeader) : null };
}

export function fetchBirthBird(body: BirthBirdRequest): Promise<BirthBirdResponse> {
  return postJson<BirthBirdResponse>("/birth-bird", body);
}

export function fetchSchedule(body: ScheduleRequest): Promise<ScheduleResponse> {
  return postJson<ScheduleResponse>("/schedule", body);
}

export function fetchScheduleWithServerTime(
  body: ScheduleRequest,
): Promise<{ data: ScheduleResponse; serverTime: Date | null }> {
  return postJsonWithMeta<ScheduleResponse>("/schedule", body);
}

export function fetchCurrentWithServerTime(
  body: ScheduleRequest,
): Promise<{ data: CurrentResponse; serverTime: Date | null }> {
  return postJsonWithMeta<CurrentResponse>("/current", body);
}

export function fetchCurrent(body: ScheduleRequest): Promise<CurrentResponse> {
  return postJson<CurrentResponse>("/current", body);
}

export function fetchWindows(body: WindowsRequest): Promise<WindowsResponse> {
  return postJson<WindowsResponse>("/windows", body);
}

export async function fetchMetadata(): Promise<EngineMetadata> {
  const res = await fetch(`${API_BASE}/metadata`);
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json();
}

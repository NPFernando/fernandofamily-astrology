// Typed client for the Pancha Pakshi API. Mirrors
// apps/api/app/modules/pancha_pakshi/{requests,models}.py exactly — field
// names here must match the Pydantic models field-for-field.
//
// Every call that carries birth data or precise coordinates is a POST with a
// JSON body. Never build a URL by interpolating any of these fields — that's
// enforced by tests/no-birth-fields-in-url.test.ts.

const API_BASE = "/api/v1/pancha-pakshi";
const COMPATIBILITY_API_BASE = "/api/v1/compatibility";
const BIRTH_NAKSHATRA_API_BASE = "/api/v1/birth-nakshatra";
const MUHURTA_API_BASE = "/api/v1/muhurta";

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
  moon_rashi_index?: number | null;
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

export type RashiId =
  | "mesha"
  | "vrishabha"
  | "mithuna"
  | "karka"
  | "simha"
  | "kanya"
  | "tula"
  | "vrischika"
  | "dhanu"
  | "makara"
  | "kumbha"
  | "meena";

export type BirthNakshatraRequest = {
  birth_date: string;
  birth_time: string;
  location_name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
};

export type BirthNakshatraResponse = {
  engine: EngineMetadata;
  location: Location;
  nakshatra: { index: number; key: string; pada: number };
  paksha: PakshaId;
  moon_rashi: { index: number; key: RashiId };
  birth_bird: BirdId;
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

export type TaraBala = {
  key: string;
  effect: EffectId;
};

export type ChandrashtamaWindow = {
  starts_at: string;
  ends_at: string;
};

export type ScheduleResponse = {
  engine: EngineMetadata;
  location: Location;
  sunrise: string;
  sunset: string;
  next_sunrise: string;
  birth_bird: BirdId;
  // Only present when a birth nakshatra is known (birth-details or
  // known-nakshatra methods); null for direct bird selection.
  tara_bala: TaraBala | null;
  // Only present when a derived natal Moon rashi is known (birth-details or
  // a saved known-nakshatra identity enriched by the Birth Nakshatra helper)
  // AND it currently matches the day's afflicted rashi (~1/12 of the time).
  chandrashtama: ChandrashtamaWindow | null;
  // No birth data needed — a pure date/place weekday lookup, always present.
  // One of repository.DISHA_KEYS, but plain str in the Pydantic model (like
  // TaraBala.key above), so no literal union here either — see
  // lib/api-types-check.ts's _CheckSchedule drift guard.
  disha_shool: string;
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

export type CompatibilityRequest = {
  bird_a: BirdId;
  bird_b: BirdId;
};

export type RelationVariant = {
  relation: RelationId;
  count: number;
};

export type CompatibilityResponse = {
  bird_a: BirdId;
  bird_b: BirdId;
  relation: RelationId;
  context_dependent: boolean;
  sample_size: number;
  variants: RelationVariant[];
};

export type VivahaChakraRequest = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  location_name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
};

export type VivahaChakraTone = "supportive" | "caution";
export type VivahaChakraVerdictKey =
  | "family_damage"
  | "wealthy_blessed"
  | "bride_family_damage"
  | "poverty_cursed"
  | "gainful_beneficial"
  | "reputation_loss"
  | "bride_devastating"
  | "successful"
  | "wonderful_blessed";

export type VivahaChakraResponse = {
  engine: EngineMetadata;
  location: Location;
  date: string;
  time: string;
  verdict_index: number;
  verdict_key: VivahaChakraVerdictKey;
  tone: VivahaChakraTone;
  sun_nakshatra: { key: string; index: number; pada: number };
  moon_nakshatra: { key: string; index: number; pada: number };
};

// Multi-day auspicious-window search (week view). The request reuses the
// schedule request shape with target_date as the range start.
export type WindowsRequest = ScheduleRequest & {
  days: number;
  min_effect: "good" | "very_good";
  // Optional narrowing: keep only windows whose SUB-activity is in this set,
  // and/or at least this long. Omit both for the unfiltered week view.
  activities?: ActivityId[];
  min_duration_seconds?: number;
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

// Per-day aggregates for the month heat-map: same request shape with
// target_date as the range start; the response never carries window rows.
export type SummaryRequest = ScheduleRequest & {
  days: number;
  min_effect: "good" | "very_good";
};

export type SummaryDay = {
  date: string;
  window_count: number;
  good_seconds: number;
  very_good_seconds: number;
  best_effect: "good" | "very_good" | null;
};

export type SummaryResponse = {
  engine: EngineMetadata;
  location: Location;
  birth_bird: BirdId;
  from_date: string;
  days: number;
  min_effect: "good" | "very_good";
  per_day: SummaryDay[];
};

// ---------------------------------------------------------------------------
// Daily Panchanga (/api/v1/panchanga) — shapes mirror
// apps/api/app/modules/panchanga/models.py.

export type PanchangaRequest = {
  date: string; // YYYY-MM-DD
  location_name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
};

export type TithiSpan = { key: string; index: number; starts_at: string; ends_at: string };
export type NakshatraSpan = {
  key: string;
  index: number;
  pada: number;
  starts_at: string | null;
  ends_at: string;
};
export type YogaSpan = { key: string; index: number; starts_at: string; ends_at: string };
export type KaranaSpan = { key: string; index_60: number; starts_at: string; ends_at: string };
export type KalamRange = { starts_at: string; ends_at: string };
export type ChoghadiyaSpan = { key: string; is_auspicious: boolean; starts_at: string; ends_at: string };
export type HoraSpan = { key: string; is_auspicious: boolean; starts_at: string; ends_at: string };
export type GrahaPosition = {
  key: string;
  longitude_degrees: number;
  rashi_index: number;
  rashi_key: string;
  nakshatra_index: number;
  is_retrograde: boolean;
};
export type MoonRashiSpan = { key: RashiId; index: number; starts_at: string; ends_at: string };
export type Ritu = { key: string; index: number };

export type DailyPanchanga = {
  engine: EngineMetadata;
  location: Location;
  date: string;
  weekday: WeekdayId;
  paksha: PakshaId;
  sunrise: string;
  sunset: string;
  moonrise: string | null;
  moonset: string | null;
  lunar_month: { key: string; index: number; is_leap: boolean };
  moon_rashi: MoonRashiSpan;
  ritu: Ritu;
  sinhala_month: { key: string; is_adhi: boolean };
  is_poya_day: boolean;
  poya: { month_key: string } | null;
  next_poya: { date: string; month_key: string };
  tithi: TithiSpan[];
  nakshatra: NakshatraSpan[];
  yoga: YogaSpan[];
  karana: KaranaSpan[];
  kalams: { rahu: KalamRange; yamaganda: KalamRange; gulika: KalamRange };
  choghadiya: ChoghadiyaSpan[];
  hora: HoraSpan[];
  amrit_kaalam: KalamRange[];
  abhijit_muhurta: KalamRange;
  durmuhurtam: KalamRange[];
  graha_positions: GrahaPosition[];
};

export type MoonPhaseKey =
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

export type MonthPanchangaRequest = {
  year: number;
  month: number; // 1..12
  location_name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
};

export type MonthPanchangaDay = {
  date: string;
  weekday: WeekdayId;
  paksha: PakshaId;
  moon_phase: MoonPhaseKey;
  sinhala_month: { key: string; is_adhi: boolean };
  is_poya_day: boolean;
  poya: { month_key: string } | null;
  tithi: TithiSpan[];
  moonrise: string | null;
  moonset: string | null;
};

export type MonthPanchanga = {
  engine: EngineMetadata;
  location: Location;
  year: number;
  month: number;
  days: MonthPanchangaDay[];
};

export type EclipseForecastRequest = {
  from_date: string; // YYYY-MM-DD
  location_name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
};

export type SolarEclipseEvent = {
  type: string; // "partial" | "annular" | "total" | "hybrid"
  is_visible: boolean;
  max_at: string;
  first_contact_at: string | null;
  fourth_contact_at: string | null;
  magnitude: number;
  obscuration: number;
  sutak_starts_at: string | null;
  sutak_ends_at: string | null;
};

export type LunarEclipseEvent = {
  type: string; // "penumbral" | "partial" | "total"
  is_visible: boolean;
  max_at: string;
  begins_at: string | null;
  ends_at: string | null;
  partial_starts_at: string | null;
  partial_ends_at: string | null;
  totality_starts_at: string | null;
  totality_ends_at: string | null;
  umbral_magnitude: number;
  penumbral_magnitude: number;
  sutak_starts_at: string | null;
  sutak_ends_at: string | null;
};

export type EclipseForecast = {
  engine: EngineMetadata;
  location: Location;
  from_date: string;
  next_solar: SolarEclipseEvent;
  next_lunar: LunarEclipseEvent;
};

export type MuhurtaPurpose = "general" | "travel" | "study_work" | "purchase" | "home_ritual";
export type MuhurtaGrade = "excellent" | "good" | "usable";
export type MuhurtaSource = "pancha_pakshi" | "amrit_kaalam" | "abhijit_muhurta" | "choghadiya" | "hora";
export type MuhurtaCaution = "disha_shool";

type MuhurtaSearchBase = {
  from_date: string;
  days: number;
  location_name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
  purpose: MuhurtaPurpose;
  min_effect: "good" | "very_good";
  min_duration_seconds: number;
};

export type MuhurtaBirthDateTimeInput = MuhurtaSearchBase & {
  method: "birth_datetime";
  birth_date: string;
  birth_time: string;
};

export type MuhurtaNakshatraPakshaInput = MuhurtaSearchBase & {
  method: "nakshatra_paksha";
  nakshatra_index: number;
  paksha: PakshaId;
};

export type MuhurtaBirdSelectionInput = MuhurtaSearchBase & {
  method: "bird";
  bird: BirdId;
};

export type MuhurtaSearchRequest =
  | MuhurtaBirthDateTimeInput
  | MuhurtaNakshatraPakshaInput
  | MuhurtaBirdSelectionInput;

export type MuhurtaSourceOverlap = {
  source: MuhurtaSource;
  starts_at: string;
  ends_at: string;
};

export type MuhurtaCautionInfo = {
  key: MuhurtaCaution;
  value: string;
};

export type MuhurtaWindow = {
  effective_date: string;
  starts_at: string;
  ends_at: string;
  duration_seconds: number;
  grade: MuhurtaGrade;
  score: number;
  pancha_pakshi_effect: EffectId;
  pancha_pakshi_activity: ActivityId;
  reasons: MuhurtaSource[];
  cautions: MuhurtaCautionInfo[];
  source_overlaps: MuhurtaSourceOverlap[];
};

export type MuhurtaDaySummary = {
  date: string;
  window_count: number;
  best_grade: MuhurtaGrade | null;
  total_seconds: number;
};

export type MuhurtaSearchResponse = {
  engine: EngineMetadata;
  location: Location;
  birth_bird: BirdId;
  from_date: string;
  days: number;
  purpose: MuhurtaPurpose;
  windows: MuhurtaWindow[];
  per_day: MuhurtaDaySummary[];
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

export function fetchBirthNakshatra(
  body: BirthNakshatraRequest,
): Promise<BirthNakshatraResponse> {
  const res = fetch(`${BIRTH_NAKSHATRA_API_BASE}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, data);
    return data as BirthNakshatraResponse;
  });
  return res;
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

export function fetchSummary(body: SummaryRequest): Promise<SummaryResponse> {
  return postJson<SummaryResponse>("/summary", body);
}

export function fetchPanchanga(body: PanchangaRequest): Promise<DailyPanchanga> {
  const res = fetch(`/api/v1/panchanga/daily`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, data);
    return data as DailyPanchanga;
  });
  return res;
}

export function fetchPanchangaMonth(body: MonthPanchangaRequest): Promise<MonthPanchanga> {
  const res = fetch(`/api/v1/panchanga/month`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, data);
    return data as MonthPanchanga;
  });
  return res;
}

export function fetchEclipseForecast(body: EclipseForecastRequest): Promise<EclipseForecast> {
  const res = fetch(`/api/v1/panchanga/eclipses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, data);
    return data as EclipseForecast;
  });
  return res;
}

export function fetchMuhurta(body: MuhurtaSearchRequest): Promise<MuhurtaSearchResponse> {
  const res = fetch(`${MUHURTA_API_BASE}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, data);
    return data as MuhurtaSearchResponse;
  });
  return res;
}

export function fetchCompatibility(
  body: CompatibilityRequest,
): Promise<CompatibilityResponse> {
  const res = fetch(`${COMPATIBILITY_API_BASE}/birds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, data);
    return data as CompatibilityResponse;
  });
  return res;
}

export function fetchVivahaChakra(
  body: VivahaChakraRequest,
): Promise<VivahaChakraResponse> {
  const res = fetch(`${COMPATIBILITY_API_BASE}/vivaha-chakra`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new ApiError(r.status, data);
    return data as VivahaChakraResponse;
  });
  return res;
}

export async function fetchMetadata(): Promise<EngineMetadata> {
  const res = await fetch(`${API_BASE}/metadata`);
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json();
}

// Compile-time drift guard between the hand-written API client types and the
// generated OpenAPI contract (packages/contracts/api-types.d.ts, regenerated
// by packages/contracts/generate.mjs and diff-checked in CI). If a Pydantic
// model changes shape, regeneration changes the contract, and one of these
// assignability checks fails tsc — pointing at exactly which type drifted.
// This file is type-level only; it emits no runtime code and is never
// imported by the app.
import type { components } from "@fernandofamily/contracts";
import type {
  BirdId,
  ActivityId,
  PakshaId,
  PeriodKind,
  RelationId,
  EffectId,
  WeekdayId,
  RashiId,
  SubPeriod,
  MajorPeriod,
  ScheduleResponse,
  EngineMetadata,
  BirthNakshatraRequest,
  BirthNakshatraResponse,
  CompatibilityRequest,
  RelationVariant,
  CompatibilityResponse,
  MonthPanchangaRequest,
  MonthPanchanga,
  MuhurtaBirthDateTimeInput,
  MuhurtaNakshatraPakshaInput,
  MuhurtaBirdSelectionInput,
  MuhurtaMonthBirthDateTimeInput,
  MuhurtaMonthNakshatraPakshaInput,
  MuhurtaMonthBirdSelectionInput,
  MuhurtaMonthResponse,
  MuhurtaSearchResponse,
  NavamsaChartRequest,
  NavamsaChart,
  BirthChartRequest,
  BirthChart,
  DashaRequest,
  DashaTimeline,
  PartyBirthInput,
  PorondamRequest,
  PorondamPartyDetails,
  PorondamMatch,
  PorondamResult,
  PorondamResponse,
} from "@/lib/api-client";

type Generated = components["schemas"];

// Mutual assignability: A extends B and B extends A means the types match.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

// Enums must match exactly.
export type _CheckBird = Expect<Equals<BirdId, Generated["BirdId"]>>;
export type _CheckActivity = Expect<Equals<ActivityId, Generated["ActivityId"]>>;
export type _CheckPaksha = Expect<Equals<PakshaId, Generated["PakshaId"]>>;
export type _CheckKind = Expect<Equals<PeriodKind, Generated["PeriodKind"]>>;
export type _CheckRelation = Expect<Equals<RelationId, Generated["RelationId"]>>;
export type _CheckEffect = Expect<Equals<EffectId, Generated["EffectId"]>>;
export type _CheckWeekday = Expect<Equals<WeekdayId, Generated["WeekdayId"]>>;
export type _CheckRashi = Expect<Equals<RashiId, Generated["RashiId"]>>;

// Response models: the generated type must be assignable to the hand-written
// one (server can send it, client can read it). Exact equality is too strict
// here — datetimes are `string` on both sides but optional-field encodings
// can differ harmlessly — so guard the direction that matters.
export type _CheckSubPeriod = Expect<Generated["SubPeriod"] extends SubPeriod ? true : false>;
export type _CheckMajorPeriod = Expect<Generated["MajorPeriod"] extends MajorPeriod ? true : false>;
export type _CheckSchedule = Expect<
  Generated["ScheduleResponse"] extends ScheduleResponse ? true : false
>;
export type _CheckEngine = Expect<
  Generated["EngineMetadata"] extends EngineMetadata ? true : false
>;
export type _CheckBirthNakshatraRequest = Expect<
  Equals<BirthNakshatraRequest, Generated["BirthNakshatraRequest"]>
>;
export type _CheckBirthNakshatraResponse = Expect<
  Generated["BirthNakshatraResponse"] extends BirthNakshatraResponse ? true : false
>;
export type _CheckCompatibilityRequest = Expect<
  Equals<CompatibilityRequest, Generated["CompatibilityRequest"]>
>;
export type _CheckRelationVariant = Expect<Equals<RelationVariant, Generated["RelationVariant"]>>;
export type _CheckCompatibilityResponse = Expect<
  Equals<CompatibilityResponse, Generated["CompatibilityResponse"]>
>;
export type _CheckMonthPanchangaRequest = Expect<
  Equals<MonthPanchangaRequest, Generated["MonthPanchangaRequest"]>
>;
export type _CheckMonthPanchanga = Expect<
  Generated["MonthPanchanga"] extends MonthPanchanga ? true : false
>;
export type _CheckMuhurtaBirthDateTimeInput = Expect<
  Equals<MuhurtaBirthDateTimeInput, Generated["MuhurtaBirthDateTimeInput"]>
>;
export type _CheckMuhurtaNakshatraPakshaInput = Expect<
  Equals<MuhurtaNakshatraPakshaInput, Generated["MuhurtaNakshatraPakshaInput"]>
>;
export type _CheckMuhurtaBirdSelectionInput = Expect<
  Equals<MuhurtaBirdSelectionInput, Generated["MuhurtaBirdSelectionInput"]>
>;
export type _CheckMuhurtaSearchResponse = Expect<
  Generated["MuhurtaSearchResponse"] extends MuhurtaSearchResponse ? true : false
>;
export type _CheckMuhurtaMonthBirthDateTimeInput = Expect<
  Equals<MuhurtaMonthBirthDateTimeInput, Generated["MuhurtaMonthBirthDateTimeInput"]>
>;
export type _CheckMuhurtaMonthNakshatraPakshaInput = Expect<
  Equals<MuhurtaMonthNakshatraPakshaInput, Generated["MuhurtaMonthNakshatraPakshaInput"]>
>;
export type _CheckMuhurtaMonthBirdSelectionInput = Expect<
  Equals<MuhurtaMonthBirdSelectionInput, Generated["MuhurtaMonthBirdSelectionInput"]>
>;
export type _CheckMuhurtaMonthResponse = Expect<
  Generated["MuhurtaMonthResponse"] extends MuhurtaMonthResponse ? true : false
>;
export type _CheckNavamsaChartRequest = Expect<
  Equals<NavamsaChartRequest, Generated["NavamsaChartRequest"]>
>;
export type _CheckNavamsaChart = Expect<
  Generated["NavamsaChart"] extends NavamsaChart ? true : false
>;
export type _CheckBirthChartRequest = Expect<
  Equals<BirthChartRequest, Generated["BirthChartRequest"]>
>;
export type _CheckBirthChart = Expect<
  Generated["BirthChart"] extends BirthChart ? true : false
>;
export type _CheckDashaRequest = Expect<
  Equals<DashaRequest, Generated["DashaRequest"]>
>;
export type _CheckDashaTimeline = Expect<
  Generated["DashaTimeline"] extends DashaTimeline ? true : false
>;
export type _CheckPartyBirthInput = Expect<
  Equals<PartyBirthInput, Generated["PartyBirthInput"]>
>;
export type _CheckPorondamRequest = Expect<
  Equals<PorondamRequest, Generated["PorondamRequest"]>
>;
export type _CheckPorondamPartyDetails = Expect<
  Generated["PartyDetails"] extends PorondamPartyDetails ? true : false
>;
export type _CheckPorondamMatch = Expect<
  Generated["PorondamMatch"] extends PorondamMatch ? true : false
>;
export type _CheckPorondamResult = Expect<
  Generated["PorondamResult"] extends PorondamResult ? true : false
>;
export type _CheckPorondamResponse = Expect<
  Generated["PorondamResponse"] extends PorondamResponse ? true : false
>;

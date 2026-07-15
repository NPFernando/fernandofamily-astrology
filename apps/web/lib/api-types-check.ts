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
  SubPeriod,
  MajorPeriod,
  ScheduleResponse,
  EngineMetadata,
  CompatibilityRequest,
  RelationVariant,
  CompatibilityResponse,
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
export type _CheckCompatibilityRequest = Expect<
  Equals<CompatibilityRequest, Generated["CompatibilityRequest"]>
>;
export type _CheckRelationVariant = Expect<Equals<RelationVariant, Generated["RelationVariant"]>>;
export type _CheckCompatibilityResponse = Expect<
  Equals<CompatibilityResponse, Generated["CompatibilityResponse"]>
>;

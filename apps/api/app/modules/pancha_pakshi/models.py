from datetime import datetime

from pydantic import BaseModel

from app.modules.pancha_pakshi.enums import ActivityId, BirdId, EffectId, PakshaId, PeriodKind, RelationId, WeekdayId


class EngineMetadata(BaseModel):
    name: str = "PyJHora"
    version: str
    commit: str
    csv_checksum: str
    ephemeris_manifest_checksum: str
    deployed_commit: str


class Location(BaseModel):
    name: str
    latitude: float
    longitude: float
    iana_tz: str
    utc_offset_minutes: int


class SubPeriod(BaseModel):
    id: str
    kind: PeriodKind
    major_index: int
    sub_index: int
    starts_at: datetime
    ends_at: datetime
    duration_seconds: int
    main_bird: BirdId
    main_activity: ActivityId
    sub_bird: BirdId
    sub_activity: ActivityId
    relation: RelationId
    power_factor: float
    effect: EffectId
    rating: float
    is_current: bool


class MajorPeriod(BaseModel):
    index: int
    kind: PeriodKind
    main_bird: BirdId
    main_activity: ActivityId
    starts_at: datetime
    ends_at: datetime
    # Per-major-period and authoritative. padu_pakshi is constant across a given
    # (bird, weekday, paksha) combination, but bharana_pakshi is confirmed to
    # DIFFER between day and night major periods in real upstream data — do not
    # assume either is constant across the whole schedule.
    padu_pakshi: BirdId
    bharana_pakshi: BirdId
    sub_periods: list[SubPeriod]


class ScheduleSummary(BaseModel):
    major_period_count: int = 10
    sub_period_count: int = 50


class TaraBala(BaseModel):
    key: str
    effect: EffectId


class ScheduleResponse(BaseModel):
    engine: EngineMetadata
    location: Location
    sunrise: datetime
    sunset: datetime
    next_sunrise: datetime
    birth_bird: BirdId
    # Only present when a birth nakshatra is known (Methods A/B — birth
    # details, or known nakshatra+paksha); null for Method C (direct bird
    # selection), which has no birth nakshatra to classify against.
    tara_bala: TaraBala | None
    paksha: PakshaId
    weekday: WeekdayId
    # Convenience mirrors of major_periods[0]'s values, kept for API-shape
    # compatibility. major_periods[i].padu_pakshi/bharana_pakshi are authoritative;
    # bharana_pakshi in particular varies by major period, so callers who need the
    # correct value for a specific period must read it from major_periods, not here.
    padu_pakshi: BirdId
    bharana_pakshi: BirdId
    current_period: SubPeriod | None
    next_period: SubPeriod | None
    major_periods: list[MajorPeriod]
    summary: ScheduleSummary

from datetime import date as date_type
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.modules.pancha_pakshi.enums import ActivityId, BirdId, EffectId
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.panchanga.models import MoonPhaseKey, PoyaInfo, SinhalaMonth


MuhurtaPurpose = Literal[
    "general",
    "travel",
    "study_work",
    "purchase",
    "home_ritual",
    "business_opening",
    "vehicle_purchase",
    "wedding_engagement",
]
MuhurtaGrade = Literal["excellent", "good", "usable"]
MuhurtaSource = Literal["pancha_pakshi"]
MuhurtaCaution = Literal["disha_shool", "vivaha_chakra"]


class MuhurtaSourceOverlap(BaseModel):
    source: MuhurtaSource
    starts_at: datetime
    ends_at: datetime


class MuhurtaCautionInfo(BaseModel):
    key: MuhurtaCaution
    value: str


class MuhurtaWindow(BaseModel):
    effective_date: date_type
    starts_at: datetime
    ends_at: datetime
    duration_seconds: int
    grade: MuhurtaGrade
    score: float
    pancha_pakshi_effect: EffectId
    pancha_pakshi_activity: ActivityId
    reasons: list[MuhurtaSource]
    cautions: list[MuhurtaCautionInfo]
    source_overlaps: list[MuhurtaSourceOverlap]


class MuhurtaDaySummary(BaseModel):
    date: date_type
    window_count: int
    best_grade: MuhurtaGrade | None
    total_seconds: int


class MuhurtaSearchResponse(BaseModel):
    engine: EngineMetadata
    location: Location
    birth_bird: BirdId
    from_date: date_type
    days: int
    purpose: MuhurtaPurpose
    windows: list[MuhurtaWindow]
    per_day: list[MuhurtaDaySummary]


class MuhurtaMonthDay(BaseModel):
    date: date_type
    window_count: int
    total_seconds: int
    best_grade: MuhurtaGrade | None
    best_score: float | None
    top_windows: list[MuhurtaWindow]
    is_poya_day: bool
    poya: PoyaInfo | None
    sinhala_month: SinhalaMonth
    moon_phase: MoonPhaseKey


class MuhurtaMonthResponse(BaseModel):
    engine: EngineMetadata
    location: Location
    birth_bird: BirdId
    year: int
    month: int
    purpose: MuhurtaPurpose
    days: list[MuhurtaMonthDay]

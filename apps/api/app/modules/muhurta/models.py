from datetime import date as date_type
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.modules.pancha_pakshi.enums import ActivityId, BirdId, EffectId
from app.modules.pancha_pakshi.models import EngineMetadata, Location


MuhurtaPurpose = Literal["general", "travel", "study_work", "purchase", "home_ritual"]
MuhurtaGrade = Literal["excellent", "good", "usable"]
MuhurtaSource = Literal[
    "pancha_pakshi",
    "amrit_kaalam",
    "abhijit_muhurta",
    "choghadiya",
    "hora",
]
MuhurtaCaution = Literal["disha_shool"]


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

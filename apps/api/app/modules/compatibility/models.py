from datetime import date as date_type
from datetime import time as time_type
from typing import Literal

from pydantic import BaseModel
from pydantic import Field

from app.modules.pancha_pakshi.enums import BirdId, RelationId
from app.modules.pancha_pakshi.models import EngineMetadata, Location


class CompatibilityRequest(BaseModel):
    bird_a: BirdId
    bird_b: BirdId


class RelationVariant(BaseModel):
    relation: RelationId
    count: int


class CompatibilityResponse(BaseModel):
    bird_a: BirdId
    bird_b: BirdId
    relation: RelationId
    context_dependent: bool
    sample_size: int
    variants: list[RelationVariant]


VivahaChakraTone = Literal["supportive", "caution"]
VivahaChakraVerdictKey = Literal[
    "family_damage",
    "wealthy_blessed",
    "bride_family_damage",
    "poverty_cursed",
    "gainful_beneficial",
    "reputation_loss",
    "bride_devastating",
    "successful",
    "wonderful_blessed",
]


class VivahaChakraRequest(BaseModel):
    date: date_type
    time: time_type
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float
    longitude: float
    iana_tz: str


class VivahaChakraNakshatra(BaseModel):
    key: str
    index: int
    pada: int


class VivahaChakraResponse(BaseModel):
    engine: EngineMetadata
    location: Location
    date: date_type
    time: time_type
    verdict_index: int = Field(ge=1, le=9)
    verdict_key: VivahaChakraVerdictKey
    tone: VivahaChakraTone
    sun_nakshatra: VivahaChakraNakshatra
    moon_nakshatra: VivahaChakraNakshatra

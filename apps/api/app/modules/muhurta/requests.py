from datetime import date as date_type
from datetime import time as time_type
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from app.modules.muhurta.models import MuhurtaPurpose
from app.modules.pancha_pakshi.enums import BirdId, PakshaId


class _MuhurtaSearchBase(BaseModel):
    from_date: date_type
    days: int = Field(default=7, ge=1, le=14)
    location_name: str = Field(min_length=1, max_length=200)
    latitude: float
    longitude: float
    iana_tz: str
    purpose: MuhurtaPurpose = "general"
    min_effect: Literal["good", "very_good"] = "good"
    min_duration_seconds: int = Field(default=900, ge=60, le=86_400)


class MuhurtaBirthDateTimeInput(_MuhurtaSearchBase):
    method: Literal["birth_datetime"]
    birth_date: date_type
    birth_time: time_type


class MuhurtaNakshatraPakshaInput(_MuhurtaSearchBase):
    method: Literal["nakshatra_paksha"]
    nakshatra_index: int
    paksha: PakshaId


class MuhurtaBirdSelectionInput(_MuhurtaSearchBase):
    method: Literal["bird"]
    bird: BirdId


MuhurtaSearchRequest = Annotated[
    Union[MuhurtaBirthDateTimeInput, MuhurtaNakshatraPakshaInput, MuhurtaBirdSelectionInput],
    Field(discriminator="method"),
]

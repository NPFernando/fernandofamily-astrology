from datetime import date as date_type
from datetime import time as time_type
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from app.modules.pancha_pakshi.enums import BirdId, PakshaId


class _TargetAndLocation(BaseModel):
    target_date: date_type
    target_time: time_type
    location_name: str
    latitude: float
    longitude: float
    iana_tz: str
    # Optional, only consulted by the /current route (ignored by /schedule and
    # /birth-bird): treat as the moment to select current/next period as-of.
    # Never trusted as an authoritative clock for anything beyond this display
    # purpose - defaults to the server's own "now" in the resolved timezone.
    as_of_date: date_type | None = None
    as_of_time: time_type | None = None


class BirthDateTimeInput(_TargetAndLocation):
    method: Literal["birth_datetime"]
    birth_date: date_type
    birth_time: time_type


class NakshatraPakshaInput(_TargetAndLocation):
    method: Literal["nakshatra_paksha"]
    nakshatra_index: int
    paksha: PakshaId


class BirdSelectionInput(_TargetAndLocation):
    method: Literal["bird"]
    bird: BirdId


# Full schedule/current requests accept any of the three input methods.
ScheduleRequest = Annotated[
    Union[BirthDateTimeInput, NakshatraPakshaInput, BirdSelectionInput], Field(discriminator="method")
]

# The birth-bird endpoint only makes sense for the two methods that actually
# resolve a bird from birth information — "bird" is direct selection, there is
# nothing to compute.
BirthBirdRequest = Annotated[Union[BirthDateTimeInput, NakshatraPakshaInput], Field(discriminator="method")]


class BirthBirdResponse(BaseModel):
    birth_bird: BirdId
    padu_pakshi: BirdId
    bharana_pakshi: BirdId

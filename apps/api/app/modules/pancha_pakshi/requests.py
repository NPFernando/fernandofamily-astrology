from datetime import date as date_type
from datetime import time as time_type
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from app.modules.pancha_pakshi.enums import ActivityId, BirdId, PakshaId, PeriodKind


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
    # Optional derived natal Moon rashi (1..12). This is enough to compute
    # Chandrashtama without storing or resending raw birth date/time/location.
    moon_rashi_index: int | None = Field(default=None, ge=1, le=12)


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


# Auspicious-window search: same three input methods; target_date acts as the
# START date and target_time as the time-of-day each daily schedule is
# computed for. days is capped low because each day costs one full schedule
# computation server-side.
class _WindowsParams(BaseModel):
    days: int = Field(default=7, ge=1, le=14)
    min_effect: Literal["good", "very_good"] = "good"
    kinds: list[PeriodKind] | None = None
    # Filters windows by their SUB-activity (the activity of the sub-period
    # itself, not the enclosing major period's main activity).
    activities: list[ActivityId] | None = None
    # Windows shorter than this are dropped. Bounded by a full day — no
    # sub-period can exceed the sunrise-to-sunrise span.
    min_duration_seconds: int | None = Field(default=None, ge=1, le=86_400)


class BirthDateTimeWindowsInput(BirthDateTimeInput, _WindowsParams):
    pass


class NakshatraPakshaWindowsInput(NakshatraPakshaInput, _WindowsParams):
    pass


class BirdSelectionWindowsInput(BirdSelectionInput, _WindowsParams):
    pass


WindowsRequest = Annotated[
    Union[BirthDateTimeWindowsInput, NakshatraPakshaWindowsInput, BirdSelectionWindowsInput],
    Field(discriminator="method"),
]


# Per-day aggregate summary (month heat-map): same three input methods with
# target_date as the START date. The cap is higher than windows' (a heat-map
# spans a month) but the response is aggregates only, never per-window rows.
class _SummaryParams(BaseModel):
    days: int = Field(default=31, ge=1, le=31)
    min_effect: Literal["good", "very_good"] = "good"


class BirthDateTimeSummaryInput(BirthDateTimeInput, _SummaryParams):
    pass


class NakshatraPakshaSummaryInput(NakshatraPakshaInput, _SummaryParams):
    pass


class BirdSelectionSummaryInput(BirdSelectionInput, _SummaryParams):
    pass


SummaryRequest = Annotated[
    Union[BirthDateTimeSummaryInput, NakshatraPakshaSummaryInput, BirdSelectionSummaryInput],
    Field(discriminator="method"),
]


class BirthBirdResponse(BaseModel):
    birth_bird: BirdId
    padu_pakshi: BirdId
    bharana_pakshi: BirdId

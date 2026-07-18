from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel

from app.modules.pancha_pakshi.models import EngineMetadata, Location


class AntardashaPeriod(BaseModel):
    key: str  # repository.GRAHA_KEYS entry, e.g. "sun" — the Antardasha lord
    start_date: date_type
    end_date: date_type
    # No duration field: Antardasha durations are fractional (e.g. Mars-Mars
    # = 4.9 months), so unlike the whole-year Mahadasha durations there is no
    # clean integer to ship. Subtract the dates if a duration is needed.


class MahadashaPeriod(BaseModel):
    key: str  # repository.GRAHA_KEYS entry, e.g. "sun"
    start_date: date_type
    end_date: date_type
    duration_years: int
    antardashas: list[AntardashaPeriod]  # 9, chronological, first lord = key


class DashaTimeline(BaseModel):
    engine: EngineMetadata
    location: Location
    birth_date: date_type
    birth_time: time_type
    periods: list[MahadashaPeriod]  # 9, chronological order (not Sun..Ketu order)

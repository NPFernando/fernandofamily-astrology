from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel

from app.modules.pancha_pakshi.models import EngineMetadata, Location


class MahadashaPeriod(BaseModel):
    key: str  # repository.GRAHA_KEYS entry, e.g. "sun"
    start_date: date_type
    end_date: date_type
    duration_years: int


class DashaTimeline(BaseModel):
    engine: EngineMetadata
    location: Location
    birth_date: date_type
    birth_time: time_type
    periods: list[MahadashaPeriod]  # 9, chronological order (not Sun..Ketu order)

from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel

from app.modules.pancha_pakshi.models import EngineMetadata, Location


class HousePoints(BaseModel):
    rashi_index: int  # 1..12
    rashi_key: str  # panchanga.repository.RASHI_KEYS
    points: int  # Sarvashtakavarga (samudhaya) point total for this house


class AshtakavargaResult(BaseModel):
    engine: EngineMetadata
    location: Location
    birth_date: date_type
    birth_time: time_type
    ascendant_rashi_index: int  # 1..12
    ascendant_rashi_key: str
    sarvashtakavarga: list[HousePoints]  # 12 entries, Mesha..Meena order
    total_points: int  # classical invariant: always 337, any chart

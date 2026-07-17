from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel

from app.modules.pancha_pakshi.models import EngineMetadata, Location


class NavamsaPlacement(BaseModel):
    key: str  # repository.GRAHA_KEYS entry, e.g. "sun"
    rashi_index: int  # 1..12
    rashi_key: str  # panchanga.repository.RASHI_KEYS


class NavamsaChart(BaseModel):
    engine: EngineMetadata
    location: Location
    birth_date: date_type
    birth_time: time_type
    # Ascendant/Lagna gets its own fields rather than being forced into
    # NavamsaPlacement's graha-shaped `key` — it isn't a graha.
    ascendant_rashi_index: int  # 1..12
    ascendant_rashi_key: str
    placements: list[NavamsaPlacement]  # 9: Sun..Ketu, GRAHA_KEYS order

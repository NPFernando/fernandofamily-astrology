from datetime import date as date_type
from datetime import time as time_type

from pydantic import BaseModel

from app.modules.pancha_pakshi.models import EngineMetadata, Location


class BirthChartPlacement(BaseModel):
    key: str  # repository.GRAHA_KEYS entry, e.g. "sun"
    rashi_index: int  # 1..12
    rashi_key: str  # panchanga.repository.RASHI_KEYS
    degrees: float  # 0..30, degrees within the rashi


class YogataraPosition(BaseModel):
    """One of the 27 CRC Table-5 junction stars, placed like a graha so the
    chart can render it in its rashi house (see yogatara.py for the pinned
    source and identification notes)."""

    nakshatra_key: str  # panchanga.repository.NAKSHATRA_KEYS entry
    rashi_index: int  # 1..12
    rashi_key: str  # panchanga.repository.RASHI_KEYS
    degrees: float  # 0..30, degrees within the rashi


class GrahaYogatara(BaseModel):
    """A graha's nakshatra and the angular distance to that nakshatra's
    junction star. Note the star can sit outside its own 13deg20' division
    (CRC documents seven such cases), so separation is not bounded by the
    division width."""

    key: str  # repository.GRAHA_KEYS entry, e.g. "moon"
    nakshatra_key: str  # the graha's nakshatra (by equal-division longitude)
    separation_degrees: float  # 0..180, |graha - yogatara| along the ecliptic


class BirthChart(BaseModel):
    engine: EngineMetadata
    location: Location
    birth_date: date_type
    birth_time: time_type
    # Ascendant/Lagna gets its own fields rather than being forced into
    # BirthChartPlacement's graha-shaped `key` — it isn't a graha.
    ascendant_rashi_index: int  # 1..12
    ascendant_rashi_key: str
    ascendant_degrees: float  # 0..30, degrees within the ascendant_rashi
    placements: list[BirthChartPlacement]  # 9: Sun..Ketu, GRAHA_KEYS order
    yogataras: list[YogataraPosition]  # 27, NAKSHATRA_KEYS order
    graha_yogataras: list[GrahaYogatara]  # 9, GRAHA_KEYS order

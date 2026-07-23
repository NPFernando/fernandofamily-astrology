from pydantic import BaseModel

from app.modules.pancha_pakshi.models import EngineMetadata, Location


class PartyDetails(BaseModel):
    location: Location
    nakshatra_index: int  # 1..27
    nakshatra_key: str
    rashi_index: int  # 1..12
    rashi_key: str


class PorondamMatch(BaseModel):
    key: str  # repository keys: nakshatra, gana, yoni, rashi, rashyadpathi, vashya, vedha, sthree_deergha
    passed: bool


class PorondamResult(BaseModel):
    matches: list[PorondamMatch]  # 8 entries, this round
    passed_count: int
    checked_count: int  # always 8 this round — Mahendra and Rajju (2 of the 10 classical dasa porondam) remain unshipped, see calculator.py's module docstring


class PorondamResponse(BaseModel):
    engine: EngineMetadata
    bride: PartyDetails
    groom: PartyDetails
    result: PorondamResult

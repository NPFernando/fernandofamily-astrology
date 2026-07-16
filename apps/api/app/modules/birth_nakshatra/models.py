from pydantic import BaseModel

from app.modules.birth_nakshatra.repository import RashiId
from app.modules.pancha_pakshi.enums import BirdId, PakshaId
from app.modules.pancha_pakshi.models import EngineMetadata, Location


class BirthNakshatraDetails(BaseModel):
    index: int
    key: str
    pada: int


class MoonRashi(BaseModel):
    index: int
    key: RashiId


class BirthNakshatraResponse(BaseModel):
    engine: EngineMetadata
    location: Location
    nakshatra: BirthNakshatraDetails
    paksha: PakshaId
    moon_rashi: MoonRashi
    birth_bird: BirdId

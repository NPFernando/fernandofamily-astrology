from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel

from app.modules.pancha_pakshi.enums import PakshaId, WeekdayId
from app.modules.pancha_pakshi.models import EngineMetadata, Location


class TithiSpan(BaseModel):
    key: str
    index: int  # 1..30
    # starts_at may precede the panchanga day's sunrise (the element began the
    # previous evening); ends_at may cross midnight into the next calendar day.
    starts_at: datetime
    ends_at: datetime


class NakshatraSpan(BaseModel):
    key: str
    index: int  # 1..27
    pada: int  # 1..4, the pada at this span's start
    starts_at: datetime | None  # upstream omits the start of the "next" entry
    ends_at: datetime


class YogaSpan(BaseModel):
    key: str
    index: int  # 1..27
    starts_at: datetime
    ends_at: datetime


class KaranaSpan(BaseModel):
    key: str
    index_60: int  # 1..60 half-tithi index; key maps it to the 11 canonical karanas
    starts_at: datetime
    ends_at: datetime


class KalamRange(BaseModel):
    starts_at: datetime
    ends_at: datetime


class Kalams(BaseModel):
    rahu: KalamRange
    yamaganda: KalamRange
    gulika: KalamRange


class LunarMonth(BaseModel):
    key: str
    index: int  # 1..12, amanta, 1 = chaitra
    is_leap: bool


class DailyPanchanga(BaseModel):
    engine: EngineMetadata
    location: Location
    date: date_type
    weekday: WeekdayId
    paksha: PakshaId
    sunrise: datetime
    sunset: datetime
    # None when the moon does not rise/set during this calendar day (possible
    # at extreme latitudes, and near the poles generally) — never approximated.
    moonrise: datetime | None
    moonset: datetime | None
    lunar_month: LunarMonth
    tithi: list[TithiSpan]  # element at sunrise first; plus the next when it also falls this day
    nakshatra: list[NakshatraSpan]
    yoga: list[YogaSpan]
    karana: list[KaranaSpan]  # all half-tithi spans overlapping sunrise..next-sunrise
    kalams: Kalams

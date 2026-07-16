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


class ChoghadiyaSpan(BaseModel):
    key: str  # repository.CHOGHADIYA_KEYS
    is_auspicious: bool
    starts_at: datetime
    ends_at: datetime


class HoraSpan(BaseModel):
    key: str  # repository.HORA_PLANET_KEYS — the planet ruling this hour
    is_auspicious: bool
    starts_at: datetime
    ends_at: datetime


class GrahaPosition(BaseModel):
    key: str  # repository.GRAHA_KEYS
    longitude_degrees: float  # 0..360 sidereal, full precision
    rashi_index: int  # 1..12
    rashi_key: str  # repository.RASHI_KEYS
    nakshatra_index: int  # 1..27
    is_retrograde: bool  # always False for sun/moon (never retrograde)


class LunarMonth(BaseModel):
    key: str
    index: int  # 1..12, amanta, 1 = chaitra
    is_leap: bool


class SinhalaMonth(BaseModel):
    # The Sri Lankan Poya-cycle month for this date (e.g. "esala",
    # "adhi-esala"), named for the date's NEXT Poya day — a Poya day belongs
    # to its own month. Gazette-validated across 2021-2026 (test_poya.py).
    key: str
    is_adhi: bool


class PoyaInfo(BaseModel):
    # month_key names the Poya itself ("esala" -> Esala Full Moon Poya Day).
    month_key: str


class NextPoya(BaseModel):
    date: date_type
    month_key: str


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
    sinhala_month: SinhalaMonth
    is_poya_day: bool
    poya: PoyaInfo | None  # set only when is_poya_day
    next_poya: NextPoya  # today when today is a Poya day, else the following one
    tithi: list[TithiSpan]  # element at sunrise first; plus the next when it also falls this day
    nakshatra: list[NakshatraSpan]
    yoga: list[YogaSpan]
    karana: list[KaranaSpan]  # all half-tithi spans overlapping sunrise..next-sunrise
    kalams: Kalams
    choghadiya: list[ChoghadiyaSpan]  # 16: 8 day + 8 night, chronological
    hora: list[HoraSpan]  # 24: 12 day + 12 night, chronological
    # Favourable window(s) within today's Choghadiya (key == "amrit") — a
    # filtered view, not a separate engine call; never empty in practice but
    # not guaranteed non-empty by upstream, so modeled as a list.
    amrit_kaalam: list[KalamRange]
    abhijit_muhurta: KalamRange  # always exactly one window, ~midday
    # 1 window on Sunday/Wednesday/Saturday, 2 on every other weekday.
    durmuhurtam: list[KalamRange]
    graha_positions: list[GrahaPosition]  # 9: Sun..Ketu, repository.GRAHA_KEYS order

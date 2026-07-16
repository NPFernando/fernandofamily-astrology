from datetime import date as date_type
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.modules.pancha_pakshi.enums import PakshaId, WeekdayId
from app.modules.pancha_pakshi.models import EngineMetadata, Location

MoonPhaseKey = Literal[
    "new",
    "waxing_crescent",
    "first_quarter",
    "waxing_gibbous",
    "full",
    "waning_gibbous",
    "last_quarter",
    "waning_crescent",
]


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


class SolarEclipseEvent(BaseModel):
    type: str  # "partial" | "annular" | "total" | "hybrid"
    is_visible: bool  # any contact observable from the requested location
    max_at: datetime  # time of greatest eclipse
    # None when that specific contact isn't observable from this location
    # (e.g. occurs after local sunset) — see adapter.solar_contact_visible.
    first_contact_at: datetime | None
    fourth_contact_at: datetime | None
    magnitude: float  # NASA convention
    obscuration: float  # fraction of solar disc covered by the Moon
    # Traditional "sutak kaal" advisory window (~12h before first contact to
    # last contact) — a named classical convention, not computed astronomy;
    # None when the eclipse isn't visible from this location at all.
    sutak_starts_at: datetime | None
    sutak_ends_at: datetime | None


class LunarEclipseEvent(BaseModel):
    type: str  # "penumbral" | "partial" | "total"
    is_visible: bool
    max_at: datetime
    # Overall event bounds (penumbral phase) — None when not visible from
    # this location (see adapter.next_lunar_eclipse_raw's zero-sentinel note).
    begins_at: datetime | None
    ends_at: datetime | None
    # None unless this eclipse has a partial phase (partial or total type).
    partial_starts_at: datetime | None
    partial_ends_at: datetime | None
    # None unless this eclipse has a total phase (type == "total").
    totality_starts_at: datetime | None
    totality_ends_at: datetime | None
    umbral_magnitude: float
    penumbral_magnitude: float
    # Traditional "sutak kaal" (~9h before the eclipse begins to its end) —
    # a named classical convention, not computed astronomy.
    sutak_starts_at: datetime | None
    sutak_ends_at: datetime | None


class EclipseForecast(BaseModel):
    engine: EngineMetadata
    location: Location
    from_date: date_type  # the date the forward search started from
    next_solar: SolarEclipseEvent
    next_lunar: LunarEclipseEvent


class MonthPanchangaDay(BaseModel):
    date: date_type
    weekday: WeekdayId
    paksha: PakshaId
    moon_phase: MoonPhaseKey
    sinhala_month: SinhalaMonth
    is_poya_day: bool
    poya: PoyaInfo | None
    tithi: list[TithiSpan]
    moonrise: datetime | None
    moonset: datetime | None


class MonthPanchanga(BaseModel):
    engine: EngineMetadata
    location: Location
    year: int
    month: int
    days: list[MonthPanchangaDay]


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

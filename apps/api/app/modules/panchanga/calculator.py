from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.modules.pancha_pakshi import adapter as pp_adapter
from app.modules.pancha_pakshi.calculator import _validated_sunrise_jd, resolve_utc_offset_hours
from app.modules.pancha_pakshi.enums import PakshaId
from app.modules.pancha_pakshi.models import EngineMetadata, Location
from app.modules.pancha_pakshi.repository import WEEKDAY_ORDER
from app.modules.panchanga import adapter, repository
from app.modules.panchanga.errors import PanchangaInternalError
from app.modules.panchanga.models import (
    DailyPanchanga,
    Kalams,
    KalamRange,
    KaranaSpan,
    LunarMonth,
    NakshatraSpan,
    TithiSpan,
    YogaSpan,
)


def _hours_to_datetime(base_date: date_type, hours: float, offset_hours: float) -> datetime:
    """Element times from the engine are float local hours relative to
    midnight of `base_date` — negative reaches into the previous calendar day,
    >= 24 into following days. Normalize to an aware datetime.
    """
    base = datetime(base_date.year, base_date.month, base_date.day, tzinfo=timezone(timedelta(hours=offset_hours)))
    return base + timedelta(seconds=round(hours * 3600))


def _hms_string_to_datetime(base_date: date_type, hms: str, offset_hours: float) -> datetime:
    h, m, s = (int(part) for part in hms.split(":"))
    return _hours_to_datetime(base_date, h + m / 60 + s / 3600, offset_hours)


def _plausible_rise_set(value: list, jd: float) -> bool:
    """moonrise/moonset return implausible sentinels rather than raising when
    the event doesn't occur (same engine behavior the sunrise validation
    guards against) — accept only values that look like a real local time on
    a nearby day.
    """
    fractional_hour, result_jd = value[0], value[-1]
    return (0.0 <= fractional_hour < 24.0) and abs(result_jd - jd) <= 2.0


def compute_daily_panchanga(
    target_date: date_type,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    engine: EngineMetadata,
) -> DailyPanchanga:
    offset_hours = resolve_utc_offset_hours(target_date, tz)
    place = pp_adapter.place(location_name, latitude, longitude, offset_hours)

    # Every value is anchored at local noon: unambiguously inside the
    # sunrise-to-sunrise panchanga day. The element functions
    # (tithi/nakshatra/yogam) re-anchor to sunrise internally, so they return
    # the traditional at-sunrise elements either way — but the
    # weekday-dependent values (vaara, kalam offsets) sit exactly on the
    # vedic-day boundary at the sunrise JD itself and empirically round to
    # the PREVIOUS day there (observed: Tuesday reported as Monday, selecting
    # Monday's kalam offsets). Sunrise is still validated first so polar
    # inputs fail with the controlled error before any element math runs.
    noon_jd = pp_adapter.julian_day_number(
        pp_adapter.date(target_date.year, target_date.month, target_date.day), (12, 0, 0)
    )
    sunrise_jd = _validated_sunrise_jd(noon_jd, place)
    sunset = adapter_sunset_datetime(noon_jd, place, target_date, offset_hours)
    sunrise = _hours_to_datetime(target_date, pp_adapter.sunrise(noon_jd, place)[0], offset_hours)
    next_sunrise_jd = _validated_sunrise_jd(noon_jd + 1, place)
    next_sunrise_hours = pp_adapter.sunrise(noon_jd + 1, place)[0]
    next_sunrise = _hours_to_datetime(target_date + timedelta(days=1), next_sunrise_hours, offset_hours)
    if next_sunrise_jd <= sunrise_jd:
        raise PanchangaInternalError("next sunrise does not follow sunrise")

    weekday = WEEKDAY_ORDER[pp_adapter.weekday_index_0based(noon_jd, place)]
    paksha = PakshaId.waxing if pp_adapter.paksha_index_1based(noon_jd, place) == 1 else PakshaId.waning

    # Tithi — [no, start, end] (+ [next_no, next_start, next_end]).
    raw_tithi = adapter.tithi(noon_jd, place)
    tithi_spans = [
        TithiSpan(
            key=repository.TITHI_KEYS[int(raw_tithi[0]) - 1],
            index=int(raw_tithi[0]),
            starts_at=_hours_to_datetime(target_date, raw_tithi[1], offset_hours),
            ends_at=_hours_to_datetime(target_date, raw_tithi[2], offset_hours),
        )
    ]
    if len(raw_tithi) >= 6:
        tithi_spans.append(
            TithiSpan(
                key=repository.TITHI_KEYS[int(raw_tithi[3]) - 1],
                index=int(raw_tithi[3]),
                starts_at=_hours_to_datetime(target_date, raw_tithi[4], offset_hours),
                ends_at=_hours_to_datetime(target_date, raw_tithi[5], offset_hours),
            )
        )

    # Nakshatra — [no, pada, start, end] (+ [next_no, next_pada, next_end]).
    raw_nak = adapter.nakshatra(noon_jd, place)
    nakshatra_spans = [
        NakshatraSpan(
            key=repository.NAKSHATRA_KEYS[int(raw_nak[0]) - 1],
            index=int(raw_nak[0]),
            pada=int(raw_nak[1]),
            starts_at=_hours_to_datetime(target_date, raw_nak[2], offset_hours),
            ends_at=_hours_to_datetime(target_date, raw_nak[3], offset_hours),
        )
    ]
    if len(raw_nak) >= 7:
        nakshatra_spans.append(
            NakshatraSpan(
                key=repository.NAKSHATRA_KEYS[int(raw_nak[4]) - 1],
                index=int(raw_nak[4]),
                pada=int(raw_nak[5]),
                starts_at=None,  # upstream provides no start for the successor entry
                ends_at=_hours_to_datetime(target_date, raw_nak[6], offset_hours),
            )
        )

    # Yoga — [no, start, end, frac] (+ [next_no, next_start, next_end, next_frac]).
    raw_yoga = adapter.yogam(noon_jd, place)
    yoga_spans = [
        YogaSpan(
            key=repository.YOGA_KEYS[int(raw_yoga[0]) - 1],
            index=int(raw_yoga[0]),
            starts_at=_hours_to_datetime(target_date, raw_yoga[1], offset_hours),
            ends_at=_hours_to_datetime(target_date, raw_yoga[2], offset_hours),
        )
    ]
    if len(raw_yoga) >= 8:
        yoga_spans.append(
            YogaSpan(
                key=repository.YOGA_KEYS[int(raw_yoga[4]) - 1],
                index=int(raw_yoga[4]),
                starts_at=_hours_to_datetime(target_date, raw_yoga[5], offset_hours),
                ends_at=_hours_to_datetime(target_date, raw_yoga[6], offset_hours),
            )
        )

    karana_spans = _karana_spans(tithi_spans, sunrise, next_sunrise, target_date, offset_hours, raw_tithi)

    # Moon rise/set — genuinely absent some days at high latitude: None, never a guess.
    raw_moonrise = adapter.moonrise(noon_jd, place)
    raw_moonset = adapter.moonset(noon_jd, place)
    moonrise = (
        _hours_to_datetime(target_date, raw_moonrise[0], offset_hours)
        if _plausible_rise_set(raw_moonrise, noon_jd)
        else None
    )
    moonset = (
        _hours_to_datetime(target_date, raw_moonset[0], offset_hours)
        if _plausible_rise_set(raw_moonset, noon_jd)
        else None
    )

    raw_month = adapter.lunar_month(noon_jd, place)
    month = LunarMonth(
        key=repository.MONTH_KEYS[int(raw_month[0]) - 1],
        index=int(raw_month[0]),
        is_leap=bool(raw_month[1]),
    )

    kalams = Kalams(
        rahu=_kalam_range(noon_jd, place, "raahu kaalam", target_date, offset_hours),
        yamaganda=_kalam_range(noon_jd, place, "yamagandam", target_date, offset_hours),
        gulika=_kalam_range(noon_jd, place, "gulikai", target_date, offset_hours),
    )

    return DailyPanchanga(
        engine=engine,
        location=Location(
            name=location_name,
            latitude=latitude,
            longitude=longitude,
            iana_tz=str(tz),
            utc_offset_minutes=round(offset_hours * 60),
        ),
        date=target_date,
        weekday=weekday,
        paksha=paksha,
        sunrise=sunrise,
        sunset=sunset,
        moonrise=moonrise,
        moonset=moonset,
        lunar_month=month,
        tithi=tithi_spans,
        nakshatra=nakshatra_spans,
        yoga=yoga_spans,
        karana=karana_spans,
        kalams=kalams,
    )


def adapter_sunset_datetime(jd: float, place, base_date: date_type, offset_hours: float) -> datetime:
    return _hours_to_datetime(base_date, pp_adapter.sunset(jd, place)[0], offset_hours)


def _kalam_range(jd: float, place, option: str, base_date: date_type, offset_hours: float) -> KalamRange:
    start_hms, end_hms = adapter.trikalam(jd, place, option)
    return KalamRange(
        starts_at=_hms_string_to_datetime(base_date, start_hms, offset_hours),
        ends_at=_hms_string_to_datetime(base_date, end_hms, offset_hours),
    )


def _karana_spans(
    tithi_spans: list[TithiSpan],
    sunrise: datetime,
    next_sunrise: datetime,
    base_date: date_type,
    offset_hours: float,
    raw_tithi: list,
) -> list[KaranaSpan]:
    """Karanas are the half-tithis: tithi t covers karana indices 2t-1 (first
    half) and 2t (second half), splitting at the tithi's midpoint. The engine's
    karana() only reports the one prevailing at sunrise (it re-anchors to
    sunrise internally, verified empirically), so the day's sequence is derived
    from the tithi spans it already returned — same upstream numbers, no
    independent math beyond the midpoint. Spans overlapping
    [sunrise, next_sunrise) are included.
    """
    spans: list[KaranaSpan] = []
    # Rebuild from the raw float hours (the datetimes in tithi_spans are
    # already rounded to seconds; reuse the same rounding path for halves).
    raw_entries = [(int(raw_tithi[0]), raw_tithi[1], raw_tithi[2])]
    if len(raw_tithi) >= 6:
        raw_entries.append((int(raw_tithi[3]), raw_tithi[4], raw_tithi[5]))
    for tithi_no, start_hrs, end_hrs in raw_entries:
        mid_hrs = (start_hrs + end_hrs) / 2
        for index60, lo, hi in (
            (tithi_no * 2 - 1, start_hrs, mid_hrs),
            (tithi_no * 2, mid_hrs, end_hrs),
        ):
            starts_at = _hours_to_datetime(base_date, lo, offset_hours)
            ends_at = _hours_to_datetime(base_date, hi, offset_hours)
            if ends_at <= sunrise or starts_at >= next_sunrise:
                continue
            spans.append(
                KaranaSpan(
                    key=repository.karana_key_for_index60(index60),
                    index_60=index60,
                    starts_at=starts_at,
                    ends_at=ends_at,
                )
            )
    if not spans:
        raise PanchangaInternalError("no karana span overlaps the panchanga day")
    return spans

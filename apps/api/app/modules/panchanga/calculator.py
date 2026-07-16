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
    ChoghadiyaSpan,
    DailyPanchanga,
    HoraSpan,
    Kalams,
    KalamRange,
    KaranaSpan,
    LunarMonth,
    NakshatraSpan,
    NextPoya,
    PoyaInfo,
    SinhalaMonth,
    TithiSpan,
    YogaSpan,
)

# A purnima beginning less than this long before sunset assigns the Poya to
# the NEXT civil day. The gazette panel's tithi/sunset arithmetic differs
# from Lahiri+swisseph by single minutes; across all 73 gazetted Poya days
# 2021-2026 the observed margins split cleanly — next-day cases reach +5.9
# minutes before our computed sunset, same-day cases start at +23.3 — so any
# buffer inside that gap reproduces the gazette exactly; 15 is the round
# midpoint. Derivation: scripts/dev/poya_rule_discovery.py (rule f);
# enforcement: tests/test_poya.py.
_POYA_SUNSET_BUFFER = timedelta(minutes=15)


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


def _cumulative_hms_hours(hms_values: list[str]) -> list[float]:
    """Converts a chronologically-ordered list of independent 'HH:MM:SS'
    strings (each 0-24, no day information) into cumulative hours-since-
    base-date-midnight, detecting midnight rollovers. Unlike the float-hours
    convention this module's other elements use (where >=24 already signals
    "next day"), gauri_choghadiya()/shubha_hora() reset their HMS strings to
    be relative to whichever new calendar day a segment falls on once it
    crosses midnight — so a value smaller than the previous one means a day
    has passed; add 24 for every such rollover to make the sequence
    monotonic, then feed straight into _hours_to_datetime as normal."""
    cumulative: list[float] = []
    day_offset = 0.0
    previous: float | None = None
    for hms in hms_values:
        h, m, s = (int(part) for part in hms.split(":"))
        hours = h + m / 60 + s / 3600 + day_offset
        if previous is not None and hours < previous:
            day_offset += 24
            hours += 24
        cumulative.append(hours)
        previous = hours
    return cumulative


def _typed_hms_spans(
    raw: list[tuple[int, str, str]],
    keys: list[str],
    auspicious: list[bool],
    span_cls,
    base_date: date_type,
    offset_hours: float,
):
    """Shared parser for gauri_choghadiya()/shubha_hora()'s identical shape:
    a chronological list of (type_index, start_hms, end_hms) tuples where
    segment i's end equals segment i+1's start. Builds one combined
    boundary-timestamp list (start of the first segment, then each
    segment's end) so _cumulative_hms_hours only has to reason about
    rollovers once, not separately per segment."""
    boundaries = [raw[0][1]] + [end for _, _, end in raw]
    cumulative_hours = _cumulative_hms_hours(boundaries)
    spans = []
    for i, (type_index, _, _) in enumerate(raw):
        spans.append(
            span_cls(
                key=keys[type_index],
                is_auspicious=auspicious[type_index],
                starts_at=_hours_to_datetime(base_date, cumulative_hours[i], offset_hours),
                ends_at=_hours_to_datetime(base_date, cumulative_hours[i + 1], offset_hours),
            )
        )
    return spans


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
    adapter.ensure_ayanamsa()
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
    # Upstream returns 0 for the 12th month (Phalguna) instead of 12 —
    # negative Python indexing happened to make MONTH_KEYS[0-1] resolve to
    # the right key by accident; normalize explicitly so `index` is correct
    # too (repository.sinhala_month_key relies on this same normalization).
    month_index = 12 if int(raw_month[0]) == 0 else int(raw_month[0])
    month = LunarMonth(
        key=repository.MONTH_KEYS[month_index - 1],
        index=month_index,
        is_leap=bool(raw_month[1]),
    )

    kalams = Kalams(
        rahu=_kalam_range(noon_jd, place, "raahu kaalam", target_date, offset_hours),
        yamaganda=_kalam_range(noon_jd, place, "yamagandam", target_date, offset_hours),
        gulika=_kalam_range(noon_jd, place, "gulikai", target_date, offset_hours),
    )

    choghadiya = _typed_hms_spans(
        adapter.gauri_choghadiya(noon_jd, place),
        repository.CHOGHADIYA_KEYS,
        repository.CHOGHADIYA_AUSPICIOUS,
        ChoghadiyaSpan,
        target_date,
        offset_hours,
    )
    hora = _typed_hms_spans(
        adapter.shubha_hora(noon_jd, place),
        repository.HORA_PLANET_KEYS,
        repository.HORA_AUSPICIOUS,
        HoraSpan,
        target_date,
        offset_hours,
    )
    # A filtered view of choghadiya (key == "amrit"), not a separate engine
    # call — this IS how upstream's own amrit_kaalam() derives it too.
    amrit_kaalam = [
        KalamRange(starts_at=span.starts_at, ends_at=span.ends_at) for span in choghadiya if span.key == "amrit"
    ]
    abhijit_start, abhijit_end = adapter.abhijit_muhurta(noon_jd, place)
    abhijit_muhurta = KalamRange(
        starts_at=_hms_string_to_datetime(target_date, abhijit_start, offset_hours),
        ends_at=_hms_string_to_datetime(target_date, abhijit_end, offset_hours),
    )
    durmuhurtam_hms = adapter.durmuhurtam(noon_jd, place)
    durmuhurtam = [
        KalamRange(
            starts_at=_hms_string_to_datetime(target_date, durmuhurtam_hms[i], offset_hours),
            ends_at=_hms_string_to_datetime(target_date, durmuhurtam_hms[i + 1], offset_hours),
        )
        for i in range(0, len(durmuhurtam_hms), 2)
    ]

    is_poya, poya, next_poya, sinhala_month = compute_poya(target_date, place, offset_hours)

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
        sinhala_month=sinhala_month,
        is_poya_day=is_poya,
        poya=poya,
        next_poya=next_poya,
        tithi=tithi_spans,
        nakshatra=nakshatra_spans,
        yoga=yoga_spans,
        karana=karana_spans,
        kalams=kalams,
        choghadiya=choghadiya,
        hora=hora,
        amrit_kaalam=amrit_kaalam,
        abhijit_muhurta=abhijit_muhurta,
        durmuhurtam=durmuhurtam,
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


def _tithi_spans_raw(day: date_type, place, offset_hours: float) -> list[tuple[int, datetime, datetime]]:
    noon_jd = pp_adapter.julian_day_number(pp_adapter.date(day.year, day.month, day.day), (12, 0, 0))
    raw = adapter.tithi(noon_jd, place)
    spans = [(int(raw[0]), _hours_to_datetime(day, raw[1], offset_hours), _hours_to_datetime(day, raw[2], offset_hours))]
    if len(raw) >= 6:
        spans.append(
            (int(raw[3]), _hours_to_datetime(day, raw[4], offset_hours), _hours_to_datetime(day, raw[5], offset_hours))
        )
    return spans


def _sunset_datetime(day: date_type, place, offset_hours: float) -> datetime:
    noon_jd = pp_adapter.julian_day_number(pp_adapter.date(day.year, day.month, day.day), (12, 0, 0))
    return _hours_to_datetime(day, pp_adapter.sunset(noon_jd, place)[0], offset_hours)


def _poya_day_for_purnima(purnima_start: datetime, place, offset_hours: float) -> date_type:
    """Gazette-validated rule: the Poya is purnima's start day when purnima
    begins at least _POYA_SUNSET_BUFFER before that day's sunset, otherwise
    the next civil day (the full moon then belongs to the following night).
    Validated at Colombo — the astronomical inputs make it location-correct
    anywhere, but official gazette agreement is Colombo-referenced.
    """
    start_day = purnima_start.date()
    if purnima_start <= _sunset_datetime(start_day, place, offset_hours) - _POYA_SUNSET_BUFFER:
        return start_day
    return start_day + timedelta(days=1)


def _purnima_start_near(day: date_type, place, offset_hours: float) -> datetime | None:
    """The start instant of a purnima visible from anchors day-1/day, if any
    (a purnima's Poya can only be its start day or the day after, so these
    two anchors cover every candidate for `day`).
    """
    for anchor in (day - timedelta(days=1), day):
        for idx, start, _end in _tithi_spans_raw(anchor, place, offset_hours):
            if idx == 15:
                return start
    return None


def _sinhala_month_at(day: date_type, place) -> tuple[str, bool]:
    noon_jd = pp_adapter.julian_day_number(pp_adapter.date(day.year, day.month, day.day), (12, 0, 0))
    raw = adapter.lunar_month(noon_jd, place)
    is_adhi = bool(raw[1])
    return repository.sinhala_month_key(int(raw[0]), is_adhi), is_adhi


def compute_poya(
    target_date: date_type, place, offset_hours: float
) -> tuple[bool, PoyaInfo | None, NextPoya, SinhalaMonth]:
    is_poya = False
    poya: PoyaInfo | None = None
    start = _purnima_start_near(target_date, place, offset_hours)
    if start is not None and _poya_day_for_purnima(start, place, offset_hours) == target_date:
        is_poya = True
        key, _ = _sinhala_month_at(target_date, place)
        poya = PoyaInfo(month_key=key)

    next_poya = _next_poya(target_date, place, offset_hours)

    # The Sinhala month is named for the date's next Poya (inclusive): the
    # month runs up to and through its own full-moon day.
    month_key, is_adhi = _sinhala_month_at(next_poya.date, place)
    return is_poya, poya, next_poya, SinhalaMonth(key=month_key, is_adhi=is_adhi)


def _next_poya(target_date: date_type, place, offset_hours: float) -> NextPoya:
    """First Poya day >= target_date (a Poya day reports itself). Purnimas
    recur every ~29.5 days, so scanning day-anchors forward finds the next
    one comfortably within the cap; each anchor is one tithi call.
    """
    seen: set[str] = set()
    for offset in range(0, 40):
        anchor = target_date + timedelta(days=offset)
        for idx, start, _end in _tithi_spans_raw(anchor, place, offset_hours):
            if idx != 15 or start.isoformat() in seen:
                continue
            seen.add(start.isoformat())
            poya_day = _poya_day_for_purnima(start, place, offset_hours)
            if poya_day >= target_date:
                key, _ = _sinhala_month_at(poya_day, place)
                return NextPoya(date=poya_day, month_key=key)
    raise PanchangaInternalError("no Poya found within 40 days")

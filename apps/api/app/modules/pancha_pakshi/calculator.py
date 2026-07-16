from datetime import date as date_type
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.modules.pancha_pakshi import adapter, repository
from app.modules.pancha_pakshi.enums import BirdId, PakshaId, PeriodKind
from app.modules.pancha_pakshi.errors import PanchaPakshiInternalError, SunriseUnavailableError
from app.modules.pancha_pakshi.models import EngineMetadata, Location, MajorPeriod, ScheduleResponse, ScheduleSummary, SubPeriod

# Tolerance for floating-point JD rounding when checking boundary invariants.
_TOLERANCE_SECONDS = 2


def resolve_utc_offset_hours(target_date: date_type, tz: ZoneInfo) -> float:
    """UTC offset in hours for `tz` on `target_date`, correctly reflecting DST.
    Probed at local noon to avoid an ambiguous/nonexistent wall-clock time
    right at a transition instant.
    """
    probe = datetime(target_date.year, target_date.month, target_date.day, 12, 0, tzinfo=tz)
    return probe.utcoffset().total_seconds() / 3600.0


def _jd_to_aware_datetime(jd: float, offset_hours: float) -> datetime:
    y, m, d, fh = adapter.jd_to_gregorian(jd)
    total_seconds = round(fh * 3600)
    extra_days, total_seconds = divmod(total_seconds, 86400)
    hh, rem = divmod(total_seconds, 3600)
    mm, ss = divmod(rem, 60)
    result = datetime(y, m, d, hh, mm, ss, tzinfo=timezone(timedelta(hours=offset_hours)))
    if extra_days:
        result = result + timedelta(days=extra_days)
    return result


def _place_for_date(name: str, latitude: float, longitude: float, tz: ZoneInfo, for_date: date_type):
    offset_hours = resolve_utc_offset_hours(for_date, tz)
    place = adapter.place(name, latitude, longitude, offset_hours)
    return offset_hours, place


def _validated_sunrise_jd(jd: float, place) -> float:
    """swisseph/PyJHora do not raise a Python exception when a rise/set event
    genuinely cannot occur (e.g. polar latitudes with permanent day/night) -
    they silently return a sentinel-like value (an implausible fractional hour
    and a JD far from the input). Detect that here and raise a controlled
    error instead of propagating garbage, per spec: never a silent
    approximation.
    """
    try:
        result = adapter.sunrise(jd, place)
        fractional_hour, _, result_jd = result[0], result[1], result[-1]
    except Exception as exc:
        raise SunriseUnavailableError(f"could not calculate sunrise: {exc}") from exc
    if not (0.0 <= fractional_hour < 24.0) or abs(result_jd - jd) > 2.0:
        raise SunriseUnavailableError(
            "sunrise could not be reliably calculated for this location/date "
            "(e.g. a polar latitude with permanent daylight or darkness)"
        )
    return result_jd


def resolve_effective_jd(
    y: int, m: int, d: int, hh: int, mm: int, ss: int, name: str, latitude: float, longitude: float, tz: ZoneInfo
) -> tuple[float, float, float, object]:
    """Mirrors upstream's before-sunrise rollback exactly: if the requested
    moment is before that calendar day's sunrise, the effective Pancha Pakshi
    day is the previous sunrise-to-sunrise window.

    Critically, the UTC offset must be resolved from the *effective* calendar
    date, not the originally-requested one: if the rollback crosses a DST
    transition (e.g. a request just after local midnight on the day DST
    begins), the previous day's offset differs from the requested day's and
    must be re-resolved, not reused. Returns (jd, sunrise_jd, offset_hours, place)
    using the correctly-resolved offset/place for whichever date is effective.
    """
    adapter.ensure_ayanamsa()
    offset_hours, place = _place_for_date(name, latitude, longitude, tz, date_type(y, m, d))
    jd = adapter.julian_day_number(adapter.date(y, m, d), (hh, mm, ss))
    sunrise_jd = _validated_sunrise_jd(jd, place)
    if jd < sunrise_jd:
        jd -= 1
        eff_y, eff_m, eff_d, _ = adapter.jd_to_gregorian(jd)
        offset_hours, place = _place_for_date(name, latitude, longitude, tz, date_type(eff_y, eff_m, eff_d))
        sunrise_jd = _validated_sunrise_jd(jd, place)
    return jd, sunrise_jd, offset_hours, place


def compute_birth_bird(
    y: int, m: int, d: int, hh: int, mm: int, ss: int, name: str, latitude: float, longitude: float, tz: ZoneInfo
) -> BirdId:
    jd, _, _, place = resolve_effective_jd(y, m, d, hh, mm, ss, name, latitude, longitude, tz)
    nakshatra_1based = adapter.nakshatra_index_1based(jd, place)
    paksha_1based = adapter.paksha_index_1based(jd, place)
    bird_1based = adapter.birth_bird_1based(nakshatra_1based, paksha_1based)
    return repository.BIRD_ORDER[bird_1based - 1]


# NOTE: PyJHora's Place takes a single fixed UTC-offset-in-hours for its entire
# astronomical calculation (see resolve_effective_jd) - it has no concept of a
# mid-calculation DST shift. A schedule computed here therefore uses ONE
# offset, resolved from the effective (post-rollback) sunrise day, for every
# timestamp it returns, including next_sunrise even if that moment technically
# falls after a DST transition. This matches upstream's own architecture and
# is a documented limitation, not a bug: the alternative (a variable offset
# mid-schedule) would break the day/night-length arithmetic that assumes a
# single, uniform time reference throughout.
def compute_schedule(
    target_y: int,
    target_m: int,
    target_d: int,
    target_hh: int,
    target_mm: int,
    target_ss: int,
    location_name: str,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
    birth_bird: BirdId,
    location: Location,
    engine: EngineMetadata,
    now: datetime | None = None,
) -> ScheduleResponse:
    jd, sunrise_jd, offset_hours, place = resolve_effective_jd(
        target_y, target_m, target_d, target_hh, target_mm, target_ss, location_name, latitude, longitude, tz
    )

    weekday_0based = adapter.weekday_index_0based(jd, place)
    paksha_1based = adapter.paksha_index_1based(jd, place)

    day_length_hours = adapter.day_length(jd, place)
    night_length_hours = adapter.night_length(jd, place)
    if not (0.0 < day_length_hours < 24.0) or not (0.0 < night_length_hours < 24.0):
        raise SunriseUnavailableError(
            "day/night length could not be reliably calculated for this location/date "
            "(e.g. a polar latitude with permanent daylight or darkness)"
        )
    day_major_inc = (day_length_hours / 5.0) / 24.0
    night_major_inc = (night_length_hours / 5.0) / 24.0

    bird_1based = repository.BIRD_ORDER.index(birth_bird) + 1
    weekday_1based = weekday_0based + 1
    rows = repository.get_matching_rows(bird_1based, weekday_1based, paksha_1based)

    major_periods: list[MajorPeriod] = []
    time_from_jd = sunrise_jd
    for chunk_index in range(10):
        chunk = rows[chunk_index * 5 : (chunk_index + 1) * 5]
        _, _, dni0, mbi0, mai0, _, _, _, _, _, _, _, ppi0, bpi0 = chunk[0]
        major_inc = day_major_inc if int(dni0) == 0 else night_major_inc
        kind = PeriodKind.day if int(dni0) == 0 else PeriodKind.night
        major_start_jd = time_from_jd

        sub_periods: list[SubPeriod] = []
        for sub_index, row in enumerate(chunk):
            _, _, _, mbi, mai, sbi, sai, df, reli, pf, efi, rtng, _, _ = row
            sub_start_jd = time_from_jd
            sub_end_jd = sub_start_jd + major_inc * df
            sub_periods.append(
                SubPeriod(
                    id=f"{chunk_index}-{sub_index}",
                    kind=kind,
                    major_index=chunk_index,
                    sub_index=sub_index,
                    starts_at=_jd_to_aware_datetime(sub_start_jd, offset_hours),
                    ends_at=_jd_to_aware_datetime(sub_end_jd, offset_hours),
                    duration_seconds=round((sub_end_jd - sub_start_jd) * 86400),
                    main_bird=repository.BIRD_ORDER[int(mbi)],
                    main_activity=repository.ACTIVITY_ORDER[int(mai)],
                    sub_bird=repository.BIRD_ORDER[int(sbi)],
                    sub_activity=repository.ACTIVITY_ORDER[int(sai)],
                    relation=repository.RELATION_ORDER[int(reli)],
                    power_factor=float(pf),
                    effect=repository.EFFECT_ORDER[int(efi)],
                    rating=float(rtng),
                    is_current=False,
                )
            )
            time_from_jd = sub_end_jd

        major_periods.append(
            MajorPeriod(
                index=chunk_index,
                kind=kind,
                main_bird=repository.BIRD_ORDER[int(mbi0)],
                main_activity=repository.ACTIVITY_ORDER[int(mai0)],
                starts_at=_jd_to_aware_datetime(major_start_jd, offset_hours),
                ends_at=sub_periods[-1].ends_at,
                padu_pakshi=repository.BIRD_ORDER[int(ppi0)],
                bharana_pakshi=repository.BIRD_ORDER[int(bpi0)],
                sub_periods=sub_periods,
            )
        )

    next_sunrise_jd = time_from_jd
    sunset_jd = sunrise_jd + (day_length_hours / 24.0)

    _assert_invariants(major_periods, sunrise_jd, next_sunrise_jd, offset_hours)

    schedule = ScheduleResponse(
        engine=engine,
        location=location,
        sunrise=_jd_to_aware_datetime(sunrise_jd, offset_hours),
        sunset=_jd_to_aware_datetime(sunset_jd, offset_hours),
        next_sunrise=_jd_to_aware_datetime(next_sunrise_jd, offset_hours),
        birth_bird=birth_bird,
        paksha=PakshaId.waxing if paksha_1based == 1 else PakshaId.waning,
        weekday=repository.WEEKDAY_ORDER[weekday_0based],
        padu_pakshi=major_periods[0].padu_pakshi,
        bharana_pakshi=major_periods[0].bharana_pakshi,
        current_period=None,
        next_period=None,
        major_periods=major_periods,
        summary=ScheduleSummary(),
    )
    current, nxt = select_current_and_next(schedule, now or datetime.now(timezone(timedelta(hours=offset_hours))))
    schedule.current_period = current
    schedule.next_period = nxt
    return schedule


def select_current_and_next(schedule: ScheduleResponse, now: datetime) -> tuple[SubPeriod | None, SubPeriod | None]:
    """Start-inclusive, end-exclusive: starts_at <= now < ends_at selects current."""
    flat = [sp for mp in schedule.major_periods for sp in mp.sub_periods]
    for i, sp in enumerate(flat):
        if sp.starts_at <= now < sp.ends_at:
            current = sp.model_copy(update={"is_current": True})
            schedule.major_periods[current.major_index].sub_periods[current.sub_index] = current
            next_period = flat[i + 1] if i + 1 < len(flat) else None
            return current, next_period
    if flat and now < flat[0].starts_at:
        return None, flat[0]
    return None, None


def _assert_invariants(
    major_periods: list[MajorPeriod], sunrise_jd: float, next_sunrise_jd: float, offset_hours: float
) -> None:
    if len(major_periods) != 10:
        raise PanchaPakshiInternalError(f"expected 10 major periods, got {len(major_periods)}")
    for mp in major_periods:
        if len(mp.sub_periods) != 5:
            raise PanchaPakshiInternalError(f"major period {mp.index} has {len(mp.sub_periods)} sub-periods, expected 5")
    for idx, mp in enumerate(major_periods):
        expected_kind = PeriodKind.day if idx < 5 else PeriodKind.night
        if mp.kind != expected_kind:
            raise PanchaPakshiInternalError(f"major period {idx} has kind {mp.kind}, expected {expected_kind}")
    flat = [sp for mp in major_periods for sp in mp.sub_periods]
    for i in range(len(flat) - 1):
        if flat[i].ends_at != flat[i + 1].starts_at:
            raise PanchaPakshiInternalError(f"gap/overlap between sub-period {i} and {i + 1}")
    for mp in major_periods:
        total = sum(sp.duration_seconds for sp in mp.sub_periods)
        expected = (mp.ends_at - mp.starts_at).total_seconds()
        if abs(total - expected) > _TOLERANCE_SECONDS:
            raise PanchaPakshiInternalError(f"major period {mp.index} sub-period durations do not sum to its total")
    expected_first = _jd_to_aware_datetime(sunrise_jd, offset_hours)
    expected_last = _jd_to_aware_datetime(next_sunrise_jd, offset_hours)
    if abs((major_periods[0].starts_at - expected_first).total_seconds()) > _TOLERANCE_SECONDS:
        raise PanchaPakshiInternalError("first major period does not start at sunrise")
    if abs((major_periods[-1].sub_periods[-1].ends_at - expected_last).total_seconds()) > _TOLERANCE_SECONDS:
        raise PanchaPakshiInternalError("last sub-period does not end at next sunrise")

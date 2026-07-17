from __future__ import annotations

from calendar import monthrange
from datetime import date as date_type
from datetime import datetime, time, timedelta

from app.modules.muhurta.models import (
    MuhurtaCautionInfo,
    MuhurtaDaySummary,
    MuhurtaMonthDay,
    MuhurtaMonthResponse,
    MuhurtaSearchResponse,
    MuhurtaSourceOverlap,
    MuhurtaWindow,
)
from app.modules.muhurta.requests import MuhurtaMonthRequest, MuhurtaSearchRequest
from app.modules.pancha_pakshi.enums import ActivityId, EffectId
from app.modules.pancha_pakshi.models import EngineMetadata, ScheduleResponse, SubPeriod
from app.modules.pancha_pakshi import service as pancha_service
from app.modules.pancha_pakshi import validation
from app.modules.compatibility import service as compatibility_service
from app.modules.panchanga import service as panchanga_service
from app.modules.panchanga.models import DailyPanchanga, KalamRange
from app.modules.panchanga.requests import DailyPanchangaRequest, MonthPanchangaRequest


_NOON = time(12, 0, 0)
_MONTH_TOP_WINDOWS = 3
_EFFECT_SCORE = {EffectId.good: 50.0, EffectId.very_good: 70.0}
_GRADE_RANK = {"excellent": 0, "good": 1, "usable": 2}

_PURPOSE_ACTIVITIES: dict[str, set[ActivityId]] = {
    "general": {ActivityId.ruling, ActivityId.eating, ActivityId.walking},
    "travel": {ActivityId.walking, ActivityId.ruling},
    "study_work": {ActivityId.ruling, ActivityId.eating},
    "purchase": {ActivityId.eating, ActivityId.ruling},
    "home_ritual": {ActivityId.ruling, ActivityId.eating},
    "business_opening": {ActivityId.ruling, ActivityId.eating},
    "vehicle_purchase": {ActivityId.eating, ActivityId.ruling, ActivityId.walking},
    "wedding_engagement": {ActivityId.ruling, ActivityId.eating},
}


def search(request: MuhurtaSearchRequest, engine: EngineMetadata) -> MuhurtaSearchResponse:
    windows: list[MuhurtaWindow] = []
    summaries: list[MuhurtaDaySummary] = []
    first_schedule: ScheduleResponse | None = None

    for offset in range(request.days):
        day = request.from_date + timedelta(days=offset)
        schedule = _schedule_for_day(request, day, engine)
        if first_schedule is None:
            first_schedule = schedule
        panchanga = panchanga_service.daily_panchanga(
            DailyPanchangaRequest(
                date=day,
                location_name=request.location_name,
                latitude=request.latitude,
                longitude=request.longitude,
                iana_tz=request.iana_tz,
            ),
            engine,
        )
        day_windows = _windows_for_day(request, day, schedule, panchanga)
        windows.extend(day_windows)
        summaries.append(
            MuhurtaDaySummary(
                date=day,
                window_count=len(day_windows),
                best_grade=_best_grade(day_windows),
                total_seconds=sum(w.duration_seconds for w in day_windows),
            )
        )

    assert first_schedule is not None
    windows.sort(key=lambda w: (-w.score, w.starts_at))
    return MuhurtaSearchResponse(
        engine=first_schedule.engine,
        location=first_schedule.location,
        birth_bird=first_schedule.birth_bird,
        from_date=request.from_date,
        days=request.days,
        purpose=request.purpose,
        windows=windows,
        per_day=summaries,
    )


def month(request: MuhurtaMonthRequest, engine: EngineMetadata) -> MuhurtaMonthResponse:
    days: list[MuhurtaMonthDay] = []
    first_schedule: ScheduleResponse | None = None
    calendar_month = panchanga_service.month_panchanga(
        MonthPanchangaRequest(
            year=request.year,
            month=request.month,
            location_name=request.location_name,
            latitude=request.latitude,
            longitude=request.longitude,
            iana_tz=request.iana_tz,
        ),
        engine,
    )
    calendar_by_date = {day.date: day for day in calendar_month.days}

    for day_number in range(1, monthrange(request.year, request.month)[1] + 1):
        day = date_type(request.year, request.month, day_number)
        calendar_day = calendar_by_date[day]
        schedule = _schedule_for_day(request, day, engine)
        if first_schedule is None:
            first_schedule = schedule
        panchanga = panchanga_service.daily_panchanga(
            DailyPanchangaRequest(
                date=day,
                location_name=request.location_name,
                latitude=request.latitude,
                longitude=request.longitude,
                iana_tz=request.iana_tz,
            ),
            engine,
        )
        day_windows = _windows_for_day(request, day, schedule, panchanga)
        ranked_windows = sorted(day_windows, key=lambda w: (-w.score, w.starts_at))
        days.append(
            MuhurtaMonthDay(
                date=day,
                window_count=len(day_windows),
                total_seconds=sum(w.duration_seconds for w in day_windows),
                best_grade=_best_grade(day_windows),
                best_score=ranked_windows[0].score if ranked_windows else None,
                top_windows=ranked_windows[:_MONTH_TOP_WINDOWS],
                is_poya_day=calendar_day.is_poya_day,
                poya=calendar_day.poya,
                sinhala_month=calendar_day.sinhala_month,
                moon_phase=calendar_day.moon_phase,
            )
        )

    assert first_schedule is not None
    return MuhurtaMonthResponse(
        engine=first_schedule.engine,
        location=first_schedule.location,
        birth_bird=first_schedule.birth_bird,
        year=request.year,
        month=request.month,
        purpose=request.purpose,
        days=days,
    )


def _schedule_for_day(request: MuhurtaSearchRequest | MuhurtaMonthRequest, day: date_type, engine: EngineMetadata) -> ScheduleResponse:
    if request.method == "birth_datetime":
        return pancha_service.schedule_from_birth_datetime(
            request.birth_date,
            request.birth_time,
            day,
            _NOON,
            request.location_name,
            request.latitude,
            request.longitude,
            request.iana_tz,
            engine,
        )
    if request.method == "nakshatra_paksha":
        return pancha_service.schedule_from_nakshatra_paksha(
            request.nakshatra_index,
            request.paksha,
            None,
            day,
            _NOON,
            request.location_name,
            request.latitude,
            request.longitude,
            request.iana_tz,
            engine,
        )
    return pancha_service.schedule_from_bird(
        request.bird,
        day,
        _NOON,
        request.location_name,
        request.latitude,
        request.longitude,
        request.iana_tz,
        engine,
    )


def _windows_for_day(
    request: MuhurtaSearchRequest | MuhurtaMonthRequest,
    day: date_type,
    schedule: ScheduleResponse,
    panchanga: DailyPanchanga,
) -> list[MuhurtaWindow]:
    allowed_effects = {EffectId.very_good} if request.min_effect == "very_good" else {EffectId.good, EffectId.very_good}
    allowed_activities = _PURPOSE_ACTIVITIES[request.purpose]
    avoid_ranges = [
        panchanga.kalams.rahu,
        panchanga.kalams.yamaganda,
        panchanga.kalams.gulika,
        *panchanga.durmuhurtam,
    ]
    results: list[MuhurtaWindow] = []
    for period in _candidate_periods(schedule, allowed_effects, allowed_activities):
        for starts_at, ends_at in _subtract_ranges(period.starts_at, period.ends_at, avoid_ranges):
            duration_seconds = int((ends_at - starts_at).total_seconds())
            if duration_seconds < request.min_duration_seconds:
                continue
            score, reasons, overlaps = _score_window(starts_at, ends_at, period, panchanga)
            results.append(
                MuhurtaWindow(
                    effective_date=day,
                    starts_at=starts_at,
                    ends_at=ends_at,
                    duration_seconds=duration_seconds,
                    grade=_grade(score),
                    score=round(score, 2),
                    pancha_pakshi_effect=period.effect,
                    pancha_pakshi_activity=period.sub_activity,
                    reasons=reasons,
                    cautions=_cautions(request, schedule, starts_at, engine=panchanga.engine),
                    source_overlaps=overlaps,
                )
            )
    return sorted(results, key=lambda w: (w.starts_at, -w.score))


def _candidate_periods(
    schedule: ScheduleResponse,
    allowed_effects: set[EffectId],
    allowed_activities: set[ActivityId],
) -> list[SubPeriod]:
    return [
        sp
        for major in schedule.major_periods
        for sp in major.sub_periods
        if sp.effect in allowed_effects and sp.sub_activity in allowed_activities
    ]


def _subtract_ranges(
    starts_at: datetime,
    ends_at: datetime,
    blocked_ranges: list[KalamRange],
) -> list[tuple[datetime, datetime]]:
    segments = [(starts_at, ends_at)]
    for blocked in blocked_ranges:
        next_segments: list[tuple[datetime, datetime]] = []
        for segment_start, segment_end in segments:
            overlap_start = max(segment_start, blocked.starts_at)
            overlap_end = min(segment_end, blocked.ends_at)
            if overlap_start >= overlap_end:
                next_segments.append((segment_start, segment_end))
                continue
            if segment_start < overlap_start:
                next_segments.append((segment_start, overlap_start))
            if overlap_end < segment_end:
                next_segments.append((overlap_end, segment_end))
        segments = next_segments
    return segments


def _score_window(
    starts_at: datetime,
    ends_at: datetime,
    period: SubPeriod,
    panchanga: DailyPanchanga,
) -> tuple[float, list[str], list[MuhurtaSourceOverlap]]:
    # Duration bonus must reflect the actual (possibly kalam/durmuhurtam
    # -clipped) window being scored, not the source Pancha Pakshi period's
    # own unclipped span — otherwise a barely-usable sliver of a good period
    # scores identically to the full, unclipped period (confirmed via direct
    # reproduction: a 2-minute window and a 44-minute window carved from the
    # same 45-minute period scored the same before this fix).
    window_duration_seconds = (ends_at - starts_at).total_seconds()
    score = _EFFECT_SCORE[period.effect] + min(window_duration_seconds / 1800.0, 12.0)
    reasons: list[str] = ["pancha_pakshi"]
    overlaps = [
        MuhurtaSourceOverlap(source="pancha_pakshi", starts_at=starts_at, ends_at=ends_at),
    ]

    positive_ranges: list[tuple[str, datetime, datetime, float]] = []
    positive_ranges.extend(("amrit_kaalam", r.starts_at, r.ends_at, 12.0) for r in panchanga.amrit_kaalam)
    positive_ranges.append(("abhijit_muhurta", panchanga.abhijit_muhurta.starts_at, panchanga.abhijit_muhurta.ends_at, 10.0))
    positive_ranges.extend(
        ("choghadiya", span.starts_at, span.ends_at, 5.0) for span in panchanga.choghadiya if span.is_auspicious
    )
    positive_ranges.extend(("hora", span.starts_at, span.ends_at, 4.0) for span in panchanga.hora if span.is_auspicious)

    for source, source_start, source_end, bonus in positive_ranges:
        overlap_start = max(starts_at, source_start)
        overlap_end = min(ends_at, source_end)
        if overlap_start >= overlap_end:
            continue
        if source not in reasons:
            reasons.append(source)
        overlaps.append(MuhurtaSourceOverlap(source=source, starts_at=overlap_start, ends_at=overlap_end))
        coverage = (overlap_end - overlap_start).total_seconds() / max((ends_at - starts_at).total_seconds(), 1)
        score += bonus * coverage

    return score, reasons, overlaps


def _grade(score: float) -> str:
    if score >= 82:
        return "excellent"
    if score >= 65:
        return "good"
    return "usable"


def _best_grade(windows: list[MuhurtaWindow]) -> str | None:
    if not windows:
        return None
    return min((w.grade for w in windows), key=lambda grade: _GRADE_RANK[grade])


def _cautions(
    request: MuhurtaSearchRequest | MuhurtaMonthRequest,
    schedule: ScheduleResponse,
    starts_at: datetime,
    engine: EngineMetadata,
) -> list[MuhurtaCautionInfo]:
    cautions: list[MuhurtaCautionInfo] = []
    if request.purpose in {"travel", "vehicle_purchase"}:
        cautions.append(MuhurtaCautionInfo(key="disha_shool", value=schedule.disha_shool))
    if request.purpose == "wedding_engagement":
        tz = validation.validate_location(request.latitude, request.longitude, request.iana_tz)
        verdict = compatibility_service.vivaha_chakra(
            starts_at.date(),
            starts_at.timetz().replace(tzinfo=None),
            request.location_name,
            request.latitude,
            request.longitude,
            tz,
            engine,
        )
        cautions.append(MuhurtaCautionInfo(key="vivaha_chakra", value=verdict.verdict_key))
    return cautions

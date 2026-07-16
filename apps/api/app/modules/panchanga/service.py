from calendar import monthrange
from datetime import date as date_type

from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.validation import validate_location, validate_supported_date
from app.modules.panchanga.calculator import compute_daily_panchanga, compute_eclipse_forecast, compute_month_panchanga
from app.modules.panchanga.models import DailyPanchanga, EclipseForecast, MonthPanchanga
from app.modules.panchanga.requests import DailyPanchangaRequest, EclipseForecastRequest, MonthPanchangaRequest


def daily_panchanga(request: DailyPanchangaRequest, engine: EngineMetadata) -> DailyPanchanga:
    tz = validate_location(request.latitude, request.longitude, request.iana_tz)
    validate_supported_date(request.date)
    return compute_daily_panchanga(
        target_date=request.date,
        location_name=request.location_name,
        latitude=request.latitude,
        longitude=request.longitude,
        tz=tz,
        engine=engine,
    )


def eclipse_forecast(request: EclipseForecastRequest, engine: EngineMetadata) -> EclipseForecast:
    tz = validate_location(request.latitude, request.longitude, request.iana_tz)
    validate_supported_date(request.from_date)
    return compute_eclipse_forecast(
        from_date=request.from_date,
        location_name=request.location_name,
        latitude=request.latitude,
        longitude=request.longitude,
        tz=tz,
        engine=engine,
    )


def month_panchanga(request: MonthPanchangaRequest, engine: EngineMetadata) -> MonthPanchanga:
    tz = validate_location(request.latitude, request.longitude, request.iana_tz)
    first_day = date_type(request.year, request.month, 1)
    last_day = date_type(request.year, request.month, monthrange(request.year, request.month)[1])
    validate_supported_date(first_day)
    validate_supported_date(last_day)
    return compute_month_panchanga(
        year=request.year,
        month=request.month,
        location_name=request.location_name,
        latitude=request.latitude,
        longitude=request.longitude,
        tz=tz,
        engine=engine,
    )

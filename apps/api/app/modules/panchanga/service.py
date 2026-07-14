from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.validation import validate_location, validate_supported_date
from app.modules.panchanga.calculator import compute_daily_panchanga
from app.modules.panchanga.models import DailyPanchanga
from app.modules.panchanga.requests import DailyPanchangaRequest


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

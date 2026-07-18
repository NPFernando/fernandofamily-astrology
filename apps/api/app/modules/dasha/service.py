from app.modules.dasha.calculator import compute_dasha_timeline
from app.modules.dasha.models import DashaTimeline
from app.modules.dasha.requests import DashaRequest
from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.validation import validate_location, validate_supported_date


def dasha_timeline(request: DashaRequest, engine: EngineMetadata) -> DashaTimeline:
    tz = validate_location(request.latitude, request.longitude, request.iana_tz)
    validate_supported_date(request.birth_date, "birth_date")
    return compute_dasha_timeline(
        birth_date=request.birth_date,
        birth_time=request.birth_time,
        location_name=request.location_name,
        latitude=request.latitude,
        longitude=request.longitude,
        tz=tz,
        engine=engine,
    )

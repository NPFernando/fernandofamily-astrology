from app.modules.ashtakavarga.calculator import compute_ashtakavarga
from app.modules.ashtakavarga.models import AshtakavargaResult
from app.modules.ashtakavarga.requests import AshtakavargaRequest
from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.validation import validate_location, validate_supported_date


def ashtakavarga(request: AshtakavargaRequest, engine: EngineMetadata) -> AshtakavargaResult:
    tz = validate_location(request.latitude, request.longitude, request.iana_tz)
    validate_supported_date(request.birth_date, "birth_date")
    return compute_ashtakavarga(
        birth_date=request.birth_date,
        birth_time=request.birth_time,
        location_name=request.location_name,
        latitude=request.latitude,
        longitude=request.longitude,
        tz=tz,
        engine=engine,
    )

from app.modules.birth_chart.calculator import compute_birth_chart
from app.modules.birth_chart.models import BirthChart
from app.modules.birth_chart.requests import BirthChartRequest
from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.validation import validate_location, validate_supported_date


def birth_chart(request: BirthChartRequest, engine: EngineMetadata) -> BirthChart:
    tz = validate_location(request.latitude, request.longitude, request.iana_tz)
    validate_supported_date(request.birth_date, "birth_date")
    return compute_birth_chart(
        birth_date=request.birth_date,
        birth_time=request.birth_time,
        location_name=request.location_name,
        latitude=request.latitude,
        longitude=request.longitude,
        tz=tz,
        engine=engine,
    )

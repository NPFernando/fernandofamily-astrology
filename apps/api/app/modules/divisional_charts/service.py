from app.modules.divisional_charts.calculator import compute_navamsa_chart
from app.modules.divisional_charts.models import NavamsaChart
from app.modules.divisional_charts.requests import NavamsaChartRequest
from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.validation import validate_location, validate_supported_date


def navamsa_chart(request: NavamsaChartRequest, engine: EngineMetadata) -> NavamsaChart:
    tz = validate_location(request.latitude, request.longitude, request.iana_tz)
    validate_supported_date(request.birth_date, "birth_date")
    return compute_navamsa_chart(
        birth_date=request.birth_date,
        birth_time=request.birth_time,
        location_name=request.location_name,
        latitude=request.latitude,
        longitude=request.longitude,
        tz=tz,
        engine=engine,
    )

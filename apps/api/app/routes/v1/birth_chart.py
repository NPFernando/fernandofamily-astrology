from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.birth_chart.models import BirthChart
from app.modules.birth_chart.requests import BirthChartRequest
from app.modules.birth_chart.service import birth_chart as birth_chart_service
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/birth-chart", tags=["birth-chart"])


@router.post("/rasi", response_model=BirthChart, dependencies=[Depends(enforce_rate_limit)])
def rasi(body: BirthChartRequest) -> BirthChart:
    return birth_chart_service(body, _engine_metadata())

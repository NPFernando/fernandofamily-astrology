from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.divisional_charts.models import NavamsaChart
from app.modules.divisional_charts.requests import NavamsaChartRequest
from app.modules.divisional_charts.service import navamsa_chart
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/divisional-charts", tags=["divisional-charts"])


@router.post("/navamsa", response_model=NavamsaChart, dependencies=[Depends(enforce_rate_limit)])
def navamsa(body: NavamsaChartRequest) -> NavamsaChart:
    return navamsa_chart(body, _engine_metadata())

from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.divisional_charts.models import DasamsaChart, NavamsaChart, SaptamsaChart
from app.modules.divisional_charts.requests import (
    DasamsaChartRequest,
    NavamsaChartRequest,
    SaptamsaChartRequest,
)
from app.modules.divisional_charts.service import dasamsa_chart, navamsa_chart, saptamsa_chart
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/divisional-charts", tags=["divisional-charts"])


@router.post("/navamsa", response_model=NavamsaChart, dependencies=[Depends(enforce_rate_limit)])
def navamsa(body: NavamsaChartRequest) -> NavamsaChart:
    return navamsa_chart(body, _engine_metadata())


@router.post("/dasamsa", response_model=DasamsaChart, dependencies=[Depends(enforce_rate_limit)])
def dasamsa(body: DasamsaChartRequest) -> DasamsaChart:
    return dasamsa_chart(body, _engine_metadata())


@router.post("/saptamsa", response_model=SaptamsaChart, dependencies=[Depends(enforce_rate_limit)])
def saptamsa(body: SaptamsaChartRequest) -> SaptamsaChart:
    return saptamsa_chart(body, _engine_metadata())

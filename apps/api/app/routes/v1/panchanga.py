from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.panchanga import service
from app.modules.panchanga.models import DailyPanchanga, EclipseForecast, MonthPanchanga
from app.modules.panchanga.requests import DailyPanchangaRequest, EclipseForecastRequest, MonthPanchangaRequest
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/panchanga", tags=["panchanga"])


@router.post("/daily", response_model=DailyPanchanga, dependencies=[Depends(enforce_rate_limit)])
def daily(body: DailyPanchangaRequest) -> DailyPanchanga:
    return service.daily_panchanga(body, _engine_metadata())


@router.post("/eclipses", response_model=EclipseForecast, dependencies=[Depends(enforce_rate_limit)])
def eclipses(body: EclipseForecastRequest) -> EclipseForecast:
    return service.eclipse_forecast(body, _engine_metadata())


@router.post("/month", response_model=MonthPanchanga, dependencies=[Depends(enforce_rate_limit)])
def month(body: MonthPanchangaRequest) -> MonthPanchanga:
    return service.month_panchanga(body, _engine_metadata())

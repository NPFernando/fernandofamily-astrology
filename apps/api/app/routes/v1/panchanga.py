from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.panchanga import service
from app.modules.panchanga.models import DailyPanchanga
from app.modules.panchanga.requests import DailyPanchangaRequest
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/panchanga", tags=["panchanga"])


@router.post("/daily", response_model=DailyPanchanga, dependencies=[Depends(enforce_rate_limit)])
def daily(body: DailyPanchangaRequest) -> DailyPanchanga:
    return service.daily_panchanga(body, _engine_metadata())

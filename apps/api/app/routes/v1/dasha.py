from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.dasha.models import DashaTimeline
from app.modules.dasha.requests import DashaRequest
from app.modules.dasha.service import dasha_timeline as dasha_timeline_service
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/dasha", tags=["dasha"])


@router.post("/mahadasha", response_model=DashaTimeline, dependencies=[Depends(enforce_rate_limit)])
def mahadasha(body: DashaRequest) -> DashaTimeline:
    return dasha_timeline_service(body, _engine_metadata())

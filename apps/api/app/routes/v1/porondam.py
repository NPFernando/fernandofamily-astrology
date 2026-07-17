from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.porondam.models import PorondamResponse
from app.modules.porondam.requests import PorondamRequest
from app.modules.porondam.service import match_porondam
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/porondam", tags=["porondam"])


@router.post("/match", response_model=PorondamResponse, dependencies=[Depends(enforce_rate_limit)])
def match(body: PorondamRequest) -> PorondamResponse:
    return match_porondam(body, _engine_metadata())

from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.muhurta.models import MuhurtaSearchResponse
from app.modules.muhurta.requests import MuhurtaSearchRequest
from app.modules.muhurta import service
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/muhurta", tags=["muhurta"])


@router.post("/search", response_model=MuhurtaSearchResponse, dependencies=[Depends(enforce_rate_limit)])
def search(body: MuhurtaSearchRequest) -> MuhurtaSearchResponse:
    return service.search(body, _engine_metadata())

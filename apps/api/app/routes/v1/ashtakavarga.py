from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.ashtakavarga.models import AshtakavargaResult
from app.modules.ashtakavarga.requests import AshtakavargaRequest
from app.modules.ashtakavarga.service import ashtakavarga as ashtakavarga_service
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/ashtakavarga", tags=["ashtakavarga"])


@router.post("/calculate", response_model=AshtakavargaResult, dependencies=[Depends(enforce_rate_limit)])
def ashtakavarga(body: AshtakavargaRequest) -> AshtakavargaResult:
    return ashtakavarga_service(body, _engine_metadata())

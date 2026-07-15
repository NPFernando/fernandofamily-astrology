from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.compatibility.models import CompatibilityRequest, CompatibilityResponse
from app.modules.compatibility.service import bird_compatibility

router = APIRouter(prefix="/api/v1/compatibility", tags=["compatibility"])


@router.post("/birds", response_model=CompatibilityResponse, dependencies=[Depends(enforce_rate_limit)])
def birds(body: CompatibilityRequest) -> CompatibilityResponse:
    return bird_compatibility(body.bird_a, body.bird_b)

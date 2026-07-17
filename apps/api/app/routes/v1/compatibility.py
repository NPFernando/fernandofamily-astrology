from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.compatibility.models import (
    CompatibilityRequest,
    CompatibilityResponse,
    VivahaChakraRequest,
    VivahaChakraResponse,
)
from app.modules.compatibility.service import bird_compatibility, vivaha_chakra
from app.modules.pancha_pakshi import validation
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/compatibility", tags=["compatibility"])


@router.post("/birds", response_model=CompatibilityResponse, dependencies=[Depends(enforce_rate_limit)])
def birds(body: CompatibilityRequest) -> CompatibilityResponse:
    return bird_compatibility(body.bird_a, body.bird_b)


@router.post("/vivaha-chakra", response_model=VivahaChakraResponse, dependencies=[Depends(enforce_rate_limit)])
def vivaha_chakra_endpoint(body: VivahaChakraRequest) -> VivahaChakraResponse:
    tz = validation.validate_location(body.latitude, body.longitude, body.iana_tz)
    return vivaha_chakra(
        body.date,
        body.time,
        body.location_name,
        body.latitude,
        body.longitude,
        tz,
        _engine_metadata(),
    )

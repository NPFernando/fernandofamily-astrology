from fastapi import APIRouter, Depends

from app.core.rate_limit import enforce_rate_limit
from app.modules.birth_nakshatra.models import BirthNakshatraResponse
from app.modules.birth_nakshatra.requests import BirthNakshatraRequest
from app.modules.birth_nakshatra.service import resolve_birth_nakshatra
from app.routes.v1.pancha_pakshi import _engine_metadata

router = APIRouter(prefix="/api/v1/birth-nakshatra", tags=["birth-nakshatra"])


@router.post("/resolve", response_model=BirthNakshatraResponse, dependencies=[Depends(enforce_rate_limit)])
def resolve(body: BirthNakshatraRequest) -> BirthNakshatraResponse:
    return resolve_birth_nakshatra(body, _engine_metadata())


from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.validation import validate_location, validate_supported_date
from app.modules.porondam.calculator import compute_porondam, resolve_party
from app.modules.porondam.models import PorondamResponse
from app.modules.porondam.requests import PartyBirthInput, PorondamRequest


def _resolve(party: PartyBirthInput):
    tz = validate_location(party.latitude, party.longitude, party.iana_tz)
    validate_supported_date(party.birth_date, "birth_date")
    return resolve_party(
        birth_date=party.birth_date,
        birth_time=party.birth_time,
        location_name=party.location_name,
        latitude=party.latitude,
        longitude=party.longitude,
        tz=tz,
    )


def match_porondam(request: PorondamRequest, engine: EngineMetadata) -> PorondamResponse:
    bride = _resolve(request.bride)
    groom = _resolve(request.groom)
    result = compute_porondam(
        nakshatra_a=bride.nakshatra_index,
        rashi_a=bride.rashi_index,
        nakshatra_b=groom.nakshatra_index,
        rashi_b=groom.rashi_index,
    )
    return PorondamResponse(engine=engine, bride=bride, groom=groom, result=result)

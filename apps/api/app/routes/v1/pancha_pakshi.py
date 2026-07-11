import hashlib
import json
from datetime import datetime, time as time_type
from functools import lru_cache
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Response

from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.modules.pancha_pakshi import calculator, service
from app.modules.pancha_pakshi.models import EngineMetadata, ScheduleResponse
from app.modules.pancha_pakshi.requests import (
    BirthBirdRequest,
    BirthBirdResponse,
    BirthDateTimeInput,
    NakshatraPakshaInput,
    ScheduleRequest,
)

router = APIRouter(prefix="/api/v1/pancha-pakshi", tags=["pancha-pakshi"])


# Vendor files are immutable for the lifetime of a container (checksummed at
# build time), so the metadata — which re-reads pin.json and hashes the whole
# manifest — is computed once, not on every schedule request.
@lru_cache(maxsize=1)
def _engine_metadata() -> EngineMetadata:
    from pathlib import Path

    vendor_dir = Path(__file__).resolve().parents[3] / "vendor"
    pin = json.loads((vendor_dir / "pin.json").read_text())
    csv_checksum = _checksum_for(vendor_dir, "data/pancha_pakshi_db.csv")
    ephemeris_checksum = _manifest_checksum(vendor_dir)
    return EngineMetadata(
        version=pin["version"],
        commit=pin["commit"],
        csv_checksum=csv_checksum,
        ephemeris_manifest_checksum=ephemeris_checksum,
        deployed_commit=settings.deployed_commit,
    )


def _checksum_for(vendor_dir, relative_path: str) -> str:
    manifest_path = vendor_dir / "MANIFEST.sha256"
    for line in manifest_path.read_text().splitlines():
        if line.strip().endswith(relative_path):
            return line.split()[0]
    return "unknown"


def _manifest_checksum(vendor_dir) -> str:
    manifest_path = vendor_dir / "MANIFEST.sha256"
    return hashlib.sha256(manifest_path.read_bytes()).hexdigest()


def _resolve_schedule(body: ScheduleRequest) -> ScheduleResponse:
    engine = _engine_metadata()
    now = None
    if body.as_of_date is not None:
        as_of_time = body.as_of_time or time_type(0, 0, 0)
        tz = ZoneInfo(body.iana_tz)
        now = datetime(
            body.as_of_date.year, body.as_of_date.month, body.as_of_date.day,
            as_of_time.hour, as_of_time.minute, as_of_time.second, tzinfo=tz,
        )

    if isinstance(body, BirthDateTimeInput):
        schedule = service.schedule_from_birth_datetime(
            body.birth_date, body.birth_time, body.target_date, body.target_time,
            body.location_name, body.latitude, body.longitude, body.iana_tz, engine,
        )
    elif isinstance(body, NakshatraPakshaInput):
        schedule = service.schedule_from_nakshatra_paksha(
            body.nakshatra_index, body.paksha, body.target_date, body.target_time,
            body.location_name, body.latitude, body.longitude, body.iana_tz, engine,
        )
    else:
        schedule = service.schedule_from_bird(
            body.bird, body.target_date, body.target_time,
            body.location_name, body.latitude, body.longitude, body.iana_tz, engine,
        )

    if now is not None:
        current, nxt = calculator.select_current_and_next(schedule, now)
        schedule.current_period = current
        schedule.next_period = nxt
    return schedule


@router.post("/birth-bird", response_model=BirthBirdResponse, dependencies=[Depends(enforce_rate_limit)])
def birth_bird(body: BirthBirdRequest) -> BirthBirdResponse:
    schedule = _resolve_schedule(body)
    return BirthBirdResponse(
        birth_bird=schedule.birth_bird,
        padu_pakshi=schedule.padu_pakshi,
        bharana_pakshi=schedule.bharana_pakshi,
    )


@router.post("/schedule", response_model=ScheduleResponse, dependencies=[Depends(enforce_rate_limit)])
def schedule(body: ScheduleRequest) -> ScheduleResponse:
    return _resolve_schedule(body)


@router.post("/current", dependencies=[Depends(enforce_rate_limit)])
def current(body: ScheduleRequest) -> dict:
    result = _resolve_schedule(body)
    return {"current_period": result.current_period, "next_period": result.next_period}


@router.get("/metadata", response_model=EngineMetadata)
def metadata(response: Response) -> EngineMetadata:
    response.headers["Cache-Control"] = "public, max-age=300"
    return _engine_metadata()

import json
from pathlib import Path

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/api/v1", tags=["platform"])

def _load_features() -> list[dict]:
    here = Path(__file__).resolve()
    candidates = [
        here.parents[index] / "packages/feature-registry/features.json"
        for index in (5, 3)
        if len(here.parents) > index
    ]
    for path in candidates:
        if path.exists():
            entries = json.loads(path.read_text(encoding="utf-8"))
            return [{key: entry[key] for key in ("id", "enabled", "public")} for entry in entries]
    raise RuntimeError("feature registry manifest is missing")


_FEATURES = _load_features()


@router.get("/metadata")
def platform_metadata() -> dict:
    return {
        "app_name": settings.app_name,
        "public_base_url": settings.public_base_url,
        "public_repository_url": settings.public_repository_url,
        "deployed_commit": settings.deployed_commit,
        "supported_locales": settings.supported_locales,
        "features": _FEATURES,
    }

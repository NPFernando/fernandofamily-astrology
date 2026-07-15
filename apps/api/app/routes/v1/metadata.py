from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/api/v1", tags=["platform"])

# Hardcoded until packages/feature-registry (Phase 4) exists as the single
# source of truth for enabled/public features; this must be swapped to read
# from that registry once it lands, not maintained as a second copy.
_FEATURES = [
    {"id": "pancha-pakshi", "enabled": True, "public": True},
    {"id": "panchanga", "enabled": True, "public": True},
    {"id": "compatibility", "enabled": True, "public": True},
]


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

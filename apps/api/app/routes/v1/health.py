from fastapi import APIRouter, Response

from scripts.verify_vendor import VerificationError, run_verification

router = APIRouter(prefix="/api/v1/health", tags=["health"])


@router.get("/live")
def live() -> dict:
    return {"status": "ok"}


@router.get("/ready")
def ready(response: Response) -> dict:
    try:
        results = run_verification("fast")
    except VerificationError:
        response.status_code = 503
        return {"status": "not_ready", "failed_check": "vendor_verification_failed"}
    return {
        "status": "ok",
        "checksummed_files": results["files_checked"],
        "csv_data_rows": results["csv_data_rows"],
        "pinned_commit": results["pin"]["commit"],
    }

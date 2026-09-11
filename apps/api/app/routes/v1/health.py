from threading import Lock

from fastapi import APIRouter, Response

from scripts.verify_vendor import VerificationError, run_verification

router = APIRouter(prefix="/api/v1/health", tags=["health"])

_readiness_lock = Lock()
_readiness_result: dict | None = None
_readiness_failed = False


def initialize_readiness() -> None:
    """Verify the vendored engine once, outside a request worker thread.

    Swiss Ephemeris keeps process/thread-sensitive state. Running the check on
    import/startup avoids doing that initialization in the synchronous route
    worker, where TestClient and production probes can otherwise hang.
    """
    global _readiness_result, _readiness_failed
    with _readiness_lock:
        if _readiness_result is not None or _readiness_failed:
            return
        try:
            _readiness_result = run_verification("fast")
        except VerificationError:
            # The endpoint deliberately exposes only a stable readiness state.
            _readiness_failed = True


def reset_readiness_cache() -> None:
    """Reset cached readiness for focused tests and local diagnostics."""
    global _readiness_result, _readiness_failed
    with _readiness_lock:
        _readiness_result = None
        _readiness_failed = False


@router.get("/live")
def live() -> dict:
    return {"status": "ok"}


@router.get("/ready")
def ready(response: Response) -> dict:
    initialize_readiness()
    if _readiness_failed or _readiness_result is None:
        response.status_code = 503
        return {"status": "not_ready", "failed_check": "vendor_verification_failed"}
    results = _readiness_result
    return {
        "status": "ok",
        "checksummed_files": results["files_checked"],
        "csv_data_rows": results["csv_data_rows"],
        "pinned_commit": results["pin"]["commit"],
    }

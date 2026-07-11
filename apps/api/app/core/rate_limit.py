import threading
import time
from collections import deque

from fastapi import HTTPException, Request

# 40 requests/minute/IP for the compute-heavy pancha-pakshi POST routes: each
# request runs real swisseph astronomy calculations (sunrise/sunset/tithi/
# nakshatra) plus Pydantic validation, so it's not free, but is fast enough
# (well under 100ms observed) that a generous per-IP budget still protects
# against abuse without punishing normal interactive use (a live countdown
# widget re-polling, a user trying a few birds/dates in a row).
_WINDOW_SECONDS = 60
_MAX_REQUESTS = 40

_lock = threading.Lock()
_hits: dict[str, deque[float]] = {}


def _client_key(request: Request) -> str:
    if request.client:
        return request.client.host
    return "unknown"


def enforce_rate_limit(request: Request) -> None:
    key = _client_key(request)
    now = time.monotonic()
    with _lock:
        bucket = _hits.setdefault(key, deque())
        while bucket and now - bucket[0] > _WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= _MAX_REQUESTS:
            raise HTTPException(status_code=429, detail={"error": "rate_limited", "message": "Too many requests, please slow down."})
        bucket.append(now)

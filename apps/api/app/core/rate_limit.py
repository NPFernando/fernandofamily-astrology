import os
import threading
import time
from collections import deque

from fastapi import HTTPException, Request

from app.core.client_ip import resolved_client_ip

# 40 requests/minute/IP for the compute-heavy pancha-pakshi POST routes: each
# request runs real swisseph astronomy calculations (sunrise/sunset/tithi/
# nakshatra) plus Pydantic validation, so it's not free, but is fast enough
# (well under 100ms observed) that a generous per-IP budget still protects
# against abuse without punishing normal interactive use (a live countdown
# widget re-polling, a user trying a few birds/dates in a row).
_WINDOW_SECONDS = 60
_MAX_REQUESTS = 40

# Idle buckets are evicted so the per-IP dict can't grow without bound over a
# long container lifetime; sweeping every _SWEEP_INTERVAL seconds amortizes
# the cost instead of scanning on every request.
_SWEEP_INTERVAL = 300.0

_lock = threading.Lock()
_hits: dict[str, deque[float]] = {}
_last_sweep = 0.0


def _client_key(request: Request) -> str:
    return resolved_client_ip(request)


def _sweep_idle_buckets(now: float) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_INTERVAL:
        return
    _last_sweep = now
    stale = [key for key, bucket in _hits.items() if not bucket or now - bucket[-1] > _WINDOW_SECONDS]
    for key in stale:
        del _hits[key]


def enforce_rate_limit(request: Request) -> None:
    # Test-suite bypass: E2E runs fire many schedule computations from one
    # IP (127.0.0.1) in under a minute and would exhaust the shared bucket,
    # failing tests with 429s that have nothing to do with what they assert.
    # Never set in production compose/env files.
    if os.environ.get("RATE_LIMIT_DISABLED") == "1":
        return
    key = _client_key(request)
    now = time.monotonic()
    with _lock:
        _sweep_idle_buckets(now)
        bucket = _hits.setdefault(key, deque())
        while bucket and now - bucket[0] > _WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= _MAX_REQUESTS:
            raise HTTPException(status_code=429, detail={"error": "rate_limited", "message": "Too many requests, please slow down."})
        bucket.append(now)

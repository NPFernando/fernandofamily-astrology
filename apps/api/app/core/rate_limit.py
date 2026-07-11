import ipaddress
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

# Idle buckets are evicted so the per-IP dict can't grow without bound over a
# long container lifetime; sweeping every _SWEEP_INTERVAL seconds amortizes
# the cost instead of scanning on every request.
_SWEEP_INTERVAL = 300.0

_lock = threading.Lock()
_hits: dict[str, deque[float]] = {}
_last_sweep = 0.0


def _client_key(request: Request) -> str:
    # In production this app sits behind nginx -> docker, so the socket peer
    # (request.client.host) is always the proxy/bridge address — every real
    # visitor would share one bucket. nginx sets X-Forwarded-For with the
    # real client first; trust that header ONLY when the direct peer is a
    # private/loopback address (i.e. our own proxy), never when exposed
    # directly to the internet.
    peer = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        try:
            peer_ip = ipaddress.ip_address(peer)
        except ValueError:
            peer_ip = None
        if peer_ip is not None and (peer_ip.is_private or peer_ip.is_loopback):
            first_hop = forwarded.split(",")[0].strip()
            try:
                ipaddress.ip_address(first_hop)
                return first_hop
            except ValueError:
                pass
    return peer


def _sweep_idle_buckets(now: float) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_INTERVAL:
        return
    _last_sweep = now
    stale = [key for key, bucket in _hits.items() if not bucket or now - bucket[-1] > _WINDOW_SECONDS]
    for key in stale:
        del _hits[key]


def enforce_rate_limit(request: Request) -> None:
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

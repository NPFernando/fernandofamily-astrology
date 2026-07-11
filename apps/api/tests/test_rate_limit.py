from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core import rate_limit


def _request(peer: str, forwarded: str | None = None):
    headers = {"x-forwarded-for": forwarded} if forwarded else {}
    return SimpleNamespace(client=SimpleNamespace(host=peer), headers=headers)


@pytest.fixture(autouse=True)
def _clean_buckets():
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


def test_forwarded_ips_get_separate_buckets():
    # Behind our proxy (private peer), two different real client IPs must not
    # share a bucket — this was a production bug where every visitor hit one
    # shared 40/min budget.
    for _ in range(rate_limit._MAX_REQUESTS):
        rate_limit.enforce_rate_limit(_request("172.18.0.2", forwarded="203.0.113.10"))
    # First client is now exhausted...
    with pytest.raises(HTTPException) as exc:
        rate_limit.enforce_rate_limit(_request("172.18.0.2", forwarded="203.0.113.10"))
    assert exc.value.status_code == 429
    # ...but a second client through the same proxy is unaffected.
    rate_limit.enforce_rate_limit(_request("172.18.0.2", forwarded="198.51.100.7"))


def test_forwarded_header_ignored_from_public_peer():
    # A direct internet client must not be able to reset its own bucket by
    # spoofing X-Forwarded-For — the header is only trusted from private or
    # loopback peers (i.e. our own proxy). Note: the peer must be a genuinely
    # global IP here; Python's ipaddress counts TEST-NET documentation ranges
    # (192.0.2.x, 203.0.113.x) as private, so those don't exercise this path.
    key = rate_limit._client_key(_request("93.184.216.34", forwarded="8.8.8.8"))
    assert key == "93.184.216.34"


def test_forwarded_header_trusted_from_loopback_peer():
    key = rate_limit._client_key(_request("127.0.0.1", forwarded="203.0.113.10"))
    assert key == "203.0.113.10"


def test_malformed_forwarded_header_falls_back_to_peer():
    key = rate_limit._client_key(_request("172.18.0.2", forwarded="not-an-ip"))
    assert key == "172.18.0.2"


def test_idle_buckets_evicted(monkeypatch):
    rate_limit.enforce_rate_limit(_request("127.0.0.1", forwarded="203.0.113.10"))
    assert "203.0.113.10" in rate_limit._hits
    # Jump time far past both the window and the sweep interval.
    real_monotonic = rate_limit.time.monotonic
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: real_monotonic() + 10_000)
    monkeypatch.setattr(rate_limit, "_last_sweep", 0.0)
    rate_limit.enforce_rate_limit(_request("127.0.0.1", forwarded="198.51.100.7"))
    assert "203.0.113.10" not in rate_limit._hits

import ipaddress
from typing import Protocol


class _Client(Protocol):
    host: str


class _RequestLike(Protocol):
    client: _Client | None
    headers: dict[str, str]


def resolved_client_ip(request: _RequestLike) -> str:
    # In production this app sits behind nginx -> docker, so the socket peer
    # is the proxy/bridge address. Trust X-Forwarded-For only when that direct
    # peer is private/loopback; never let an internet client spoof it directly.
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

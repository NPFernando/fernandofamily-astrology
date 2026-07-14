import ipaddress
import threading
import time
from collections import defaultdict
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Request
from starlette.responses import PlainTextResponse, Response

from app.core.client_ip import resolved_client_ip
from app.core.config import settings

router = APIRouter(include_in_schema=False)

_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
_lock = threading.Lock()
_requests_total: dict[tuple[str, str, str], int] = defaultdict(int)
_duration_buckets: dict[tuple[str, str, str], list[int]] = defaultdict(lambda: [0] * len(_BUCKETS))
_duration_count: dict[tuple[str, str, str], int] = defaultdict(int)
_duration_sum: dict[tuple[str, str, str], float] = defaultdict(float)


def _label_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _labels(items: dict[str, str]) -> str:
    return ",".join(f'{key}="{_label_value(value)}"' for key, value in items.items())


def _route_template(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str):
        return route_path
    return "__unmatched__"


def _allowed_to_scrape(request: Request) -> bool:
    client = resolved_client_ip(request)
    try:
        client_ip = ipaddress.ip_address(client)
    except ValueError:
        return False
    for cidr in settings.metrics_allowed_cidrs:
        try:
            if client_ip in ipaddress.ip_network(cidr, strict=False):
                return True
        except ValueError:
            continue
    return False


def observe_request(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    key = (method, path, str(status_code))
    with _lock:
        _requests_total[key] += 1
        _duration_count[key] += 1
        _duration_sum[key] += duration_seconds
        buckets = _duration_buckets[key]
        for index, threshold in enumerate(_BUCKETS):
            if duration_seconds <= threshold:
                buckets[index] += 1


async def metrics_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    if request.url.path == "/metrics":
        return await call_next(request)

    start = time.monotonic()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        observe_request(
            request.method,
            _route_template(request),
            status_code,
            time.monotonic() - start,
        )


def render_metrics() -> str:
    lines = [
        "# HELP astrology_api_build_info Build and runtime metadata for the API process.",
        "# TYPE astrology_api_build_info gauge",
        "astrology_api_build_info{"
        + _labels(
            {
                "app_env": settings.app_env,
                "pyjhora_version": settings.pyjhora_version,
                "deployed_commit": settings.deployed_commit,
            }
        )
        + "} 1",
        "# HELP astrology_api_requests_total Total HTTP requests served by the API.",
        "# TYPE astrology_api_requests_total counter",
    ]

    with _lock:
        request_items = sorted(_requests_total.items())
        bucket_items = sorted(_duration_buckets.items())
        count_items = dict(_duration_count)
        sum_items = dict(_duration_sum)

    for (method, path, status_code), value in request_items:
        lines.append(
            "astrology_api_requests_total{"
            + _labels({"method": method, "path": path, "status_code": status_code})
            + f"}} {value}"
        )

    lines.extend(
        [
            "# HELP astrology_api_request_duration_seconds HTTP request duration.",
            "# TYPE astrology_api_request_duration_seconds histogram",
        ]
    )
    for key, buckets in bucket_items:
        method, path, status_code = key
        base = {"method": method, "path": path, "status_code": status_code}
        for threshold, value in zip(_BUCKETS, buckets, strict=True):
            lines.append(
                "astrology_api_request_duration_seconds_bucket{"
                + _labels({**base, "le": f"{threshold:g}"})
                + f"}} {value}"
            )
        lines.append(
            "astrology_api_request_duration_seconds_bucket{"
            + _labels({**base, "le": "+Inf"})
            + f"}} {count_items[key]}"
        )
        lines.append(
            "astrology_api_request_duration_seconds_count{"
            + _labels(base)
            + f"}} {count_items[key]}"
        )
        lines.append(
            "astrology_api_request_duration_seconds_sum{"
            + _labels(base)
            + f"}} {sum_items[key]:.6f}"
        )

    return "\n".join(lines) + "\n"


@router.get("/metrics")
def metrics(request: Request) -> PlainTextResponse:
    if not _allowed_to_scrape(request):
        return PlainTextResponse("forbidden\n", status_code=403)
    return PlainTextResponse(
        render_metrics(),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


def reset_metrics_for_tests() -> None:
    with _lock:
        _requests_total.clear()
        _duration_buckets.clear()
        _duration_count.clear()
        _duration_sum.clear()

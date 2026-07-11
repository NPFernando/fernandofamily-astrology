import json
import logging
import sys
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

# Request bodies are NEVER logged for pancha-pakshi routes (birth data, precise
# location). This is an explicit allow-list of fields the access-log middleware
# emits, not a deny-list — a field must be added here deliberately to be logged,
# so adding an unrelated field elsewhere can never accidentally leak into logs.
_ALLOWED_ACCESS_LOG_FIELDS = {"request_id", "method", "path", "status_code", "duration_ms"}


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"level": record.levelname, "logger": record.name, "message": record.getMessage()}
        extra = getattr(record, "access_log_fields", None)
        if extra:
            payload.update({k: v for k, v in extra.items() if k in _ALLOWED_ACCESS_LOG_FIELDS})
        return json.dumps(payload)


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(settings.log_level)


access_logger = logging.getLogger("access")


async def access_log_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = round((time.monotonic() - start) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    access_logger.info(
        "request",
        extra={
            "access_log_fields": {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            }
        },
    )
    return response

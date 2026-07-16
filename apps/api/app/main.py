from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import access_log_middleware, configure_logging
from app.core.metrics import metrics_middleware, router as metrics_router
from app.modules.pancha_pakshi.errors import InvalidInputError, PanchaPakshiInternalError, SunriseUnavailableError
from app.routes.v1 import birth_nakshatra, compatibility, health, metadata, muhurta, pancha_pakshi, panchanga

configure_logging()

app = FastAPI(
    title=settings.app_name,
    description="Fernando Family Astrology API",
    version=settings.pyjhora_version,
    openapi_url="/api/v1/openapi.json",
    docs_url="/api/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.middleware("http")(access_log_middleware)
app.middleware("http")(metrics_middleware)

app.include_router(metrics_router)
app.include_router(health.router)
app.include_router(metadata.router)
app.include_router(birth_nakshatra.router)
app.include_router(compatibility.router)
app.include_router(muhurta.router)
app.include_router(pancha_pakshi.router)
app.include_router(panchanga.router)


@app.exception_handler(InvalidInputError)
async def invalid_input_handler(request: Request, exc: InvalidInputError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": "invalid_input", "message": str(exc)})


@app.exception_handler(SunriseUnavailableError)
async def sunrise_unavailable_handler(request: Request, exc: SunriseUnavailableError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": "sunrise_unavailable", "message": str(exc)})


@app.exception_handler(PanchaPakshiInternalError)
async def internal_error_handler(request: Request, exc: PanchaPakshiInternalError) -> JSONResponse:
    message = str(exc) if not settings.is_production else "An internal error occurred."
    return JSONResponse(status_code=500, content={"error": "internal_error", "message": message})

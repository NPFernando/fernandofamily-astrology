# The panchanga module raises the same typed error classes as pancha_pakshi so
# the app-level exception handlers in main.py (422 invalid_input, 422
# sunrise_unavailable, 500 internal) cover both modules without duplication.
from app.modules.pancha_pakshi.errors import (  # noqa: F401
    InvalidInputError,
    PanchaPakshiInternalError as PanchangaInternalError,
    SunriseUnavailableError,
)

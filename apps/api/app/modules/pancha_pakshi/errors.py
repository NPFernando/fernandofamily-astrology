class PanchaPakshiError(Exception):
    """Base class for all typed errors raised by this module."""


class InvalidInputError(PanchaPakshiError):
    """Client-supplied input failed validation (maps to HTTP 422)."""


class SunriseUnavailableError(PanchaPakshiError):
    """Sunrise/sunset could not be reliably calculated for the given input
    (e.g. polar latitudes) — a controlled error, never a silent approximation."""


class PanchaPakshiInternalError(PanchaPakshiError):
    """An invariant the calculation must satisfy was violated. Indicates a bug
    in the calculator, not bad user input — never returned to a client as
    partial/malformed data."""

"""app/core/config.py had zero direct test coverage — only exercised
incidentally via whatever other tests happen to import `settings`. This
covers the two pieces of actual logic in the file: `_float_env` (used for
DEFAULT_LATITUDE/DEFAULT_LONGITUDE) and the CIDR/origin list parsing that
`Settings`' class body does inline.

Note: `Settings`' fields are computed once at import time from `os.environ`,
not per-instantiation, so env-var-dependent behavior is tested against
`_float_env` directly (a pure function, freely re-callable) rather than by
constructing new `Settings()` instances with monkeypatched env — the class
itself is a fixed singleton for the process lifetime by design.
"""
import pytest

from app.core.config import Settings, _float_env, settings


def test_float_env_returns_none_when_unset_and_no_default():
    assert _float_env("FF_TEST_UNSET_VAR", None) is None


def test_float_env_treats_empty_string_as_none():
    assert _float_env("FF_TEST_EMPTY_VAR", "") is None


def test_float_env_parses_a_numeric_default():
    assert _float_env("FF_TEST_UNSET_VAR", "6.9271") == 6.9271


def test_float_env_reads_the_actual_environment_variable_over_the_default(monkeypatch):
    monkeypatch.setenv("FF_TEST_LATITUDE", "7.5")
    assert _float_env("FF_TEST_LATITUDE", "6.9271") == 7.5


def test_float_env_raises_on_a_malformed_value(monkeypatch):
    """Documents current behavior rather than fixing it: a malformed
    DEFAULT_LATITUDE/DEFAULT_LONGITUDE env value crashes at import time with
    an unguarded ValueError, not a controlled startup error. Flagged during
    the 2026-07-21 test-coverage audit; left as-is (fixing it means changing
    startup-time error handling, out of scope for this pass) but locked in
    by this test so the behavior doesn't silently change either way."""
    monkeypatch.setenv("FF_TEST_BAD_FLOAT", "not-a-number")
    with pytest.raises(ValueError):
        _float_env("FF_TEST_BAD_FLOAT", None)


def test_default_metrics_allowed_cidrs_parses_into_the_documented_list():
    assert settings.metrics_allowed_cidrs == [
        "127.0.0.0/8",
        "::1/128",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
    ]


def test_default_cors_allowed_origins_parses_into_a_list():
    assert settings.cors_allowed_origins == ["http://localhost:3000"]


def test_is_production_false_by_default():
    assert settings.is_production is False


def test_is_production_true_when_app_env_is_production():
    s = Settings()
    s.app_env = "production"
    assert s.is_production is True

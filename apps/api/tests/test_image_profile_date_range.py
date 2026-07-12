from datetime import date

import pytest

from app.modules.pancha_pakshi import validation
from app.modules.pancha_pakshi.errors import InvalidInputError


def test_repo_profile_has_no_date_bound(monkeypatch):
    monkeypatch.setattr(validation, "_IMAGE_PROFILE", False)
    validation.validate_supported_date(date(1500, 6, 15))  # no raise


def test_image_profile_rejects_out_of_range(monkeypatch):
    # Outside the trimmed 1800-2399 ephemeris range swisseph silently falls
    # back to a lower-precision theory rather than raising — the controlled
    # rejection here is what upholds the no-silent-approximation rule in the
    # shipped image.
    monkeypatch.setattr(validation, "_IMAGE_PROFILE", True)
    with pytest.raises(InvalidInputError):
        validation.validate_supported_date(date(1799, 12, 31))
    with pytest.raises(InvalidInputError):
        validation.validate_supported_date(date(2400, 1, 1))
    validation.validate_supported_date(date(1800, 1, 1))  # boundary ok
    validation.validate_supported_date(date(2399, 12, 31))  # boundary ok

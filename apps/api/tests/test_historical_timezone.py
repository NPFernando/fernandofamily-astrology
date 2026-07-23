"""Regression guard for historical Sri Lankan UTC offsets.

Ceylon/Sri Lanka's civil offset has changed 4 times (WWII-era shifts, then
1996 and 2006), which matters for the historical/ancestor-chart feature
(engine allows birth dates back to 1200 CE). `resolve_utc_offset_hours`
must reproduce the IANA tzdb's own transition history for Asia/Colombo
exactly — verified here against `zdump -v Asia/Colombo`'s actual
transition instants, not a narrative secondary source (accounts of the
1996-2006 era vary by source on whether it was +6:00 or +6:30 - the tzdb
itself is ground truth).
"""
from datetime import date
from zoneinfo import ZoneInfo

import pytest

from app.modules.pancha_pakshi.calculator import resolve_utc_offset_hours

COLOMBO = ZoneInfo("Asia/Colombo")

# (date safely inside a transition window, expected UTC offset hours) —
# see `zdump -v Asia/Colombo` for the exact transition instants these
# windows sit inside.
KNOWN_OFFSETS = [
    (date(1935, 1, 1), 5.5),  # pre-1906 MMT excluded; this is +05:30 era
    (date(1942, 6, 1), 6.0),  # 1942-01-05 .. 1942-09-01
    (date(1943, 1, 1), 6.5),  # 1942-09-01 .. 1945-10-16
    (date(1970, 1, 1), 5.5),  # 1945-10-16 .. 1996-05-25
    (date(1996, 7, 1), 6.5),  # 1996-05-25 .. 1996-10-26
    (date(2000, 1, 1), 6.0),  # 1996-10-26 .. 2006-04-15
    (date(2010, 1, 1), 5.5),  # 2006-04-15 .. present
    (date(2026, 1, 1), 5.5),
]


@pytest.mark.parametrize("target_date,expected_offset", KNOWN_OFFSETS)
def test_resolve_utc_offset_matches_tzdb_history(target_date, expected_offset):
    assert resolve_utc_offset_hours(target_date, COLOMBO) == pytest.approx(expected_offset)


def test_zoneinfo_rejects_a_fixed_offset_string_instead_of_an_iana_key():
    """Confirms the request-validation layer's ZoneInfo(value) call
    (app/modules/pancha_pakshi/validation.py) can't silently accept a raw
    offset like "+05:30" in place of a real IANA zone name — it must
    raise, not succeed with the wrong semantics for historical dates."""
    with pytest.raises(Exception):
        ZoneInfo("+05:30")

"""Engine-level coverage for the newly-vendored Vimshottari Dasha subset
(`jhora/horoscope/{__init__,chart/*,dhasa/*}`, see apps/api/vendor/README.md).

This is deliberately engine-only: no `app/modules/dasha/` application module
exists yet (that's a separate future phase). This file only proves the
vendored files themselves are correct and safely importable alongside the
rest of the app.

Golden-value note, corrected after direct probing (do not re-introduce the
disproved assumption below): the natural assumption, before testing, was
that upstream's own `jhora/tests/pvr_tests.py` worked examples (not
vendored here) were generated under PyJHora's TRUE_PUSHYA ayanamsa, since
that's the default set in that file's own `__main__` block. That assumption
is wrong for `_vimsottari_test_1` specifically: reproducing all 4 of its
sub-cases (`star_position_from_moon` 1/4/5/8, each citing "Chapter 16.4,
Example 50/51" with a textbook expected `(lord, balance)` pair) showed 0/4
match under TRUE_PUSHYA but 4/4 match exactly under LAHIRI -- this app's
own pinned ayanamsa (`app.core.vendor_path.configure_ayanamsa`), with no
extra overrides needed (true-node mode and dhasa-year-duration convention
both already sit at their vendored module defaults; the Mahadasha balance
turns out insensitive to both, for this fixture). In hindsight this makes
sense: textbook worked examples use the traditional Lahiri/Chitrapaksha
ayanamsa; TRUE_PUSHYA is only `pvr_tests.py`'s own opinionated default for
its `__main__` run, not what individual fixtures were computed under.

That makes this a stronger golden than a TRUE_PUSHYA-reproduction would
have been: it proves both that the vendored files faithfully reproduce
upstream math, and that this app's actual production ayanamsa yields
textbook-correct dasha -- not faithfulness against a configuration this
app never ships.
"""
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

import pytest  # noqa: E402
from jhora import const, utils  # noqa: E402
from jhora.panchanga import drik  # noqa: E402
from jhora.horoscope.dhasa.graha import vimsottari  # noqa: E402

# Same birth used by jhora/tests/pvr_tests.py's _vimsottari_test_1 (not
# vendored -- source cited here, not the file itself), citing "Chapter
# 16.4, Example 50/51". (star_position_from_moon, expected_lord, expected_balance).
_TEXTBOOK_CASES = [
    (1, 2, (2, 2, 29)),
    (4, 6, (6, 1, 5)),
    (5, 3, (5, 5, 14)),
    (8, 0, (1, 11, 3)),
]


def _textbook_birth():
    place = drik.Place("unknown", 16 + 15 / 60, 81 + 12.0 / 60, -4.0)
    jd = utils.julian_day_number((2000, 4, 28), (5, 50, 0))
    return jd, place


def test_vimsottari_matches_textbook_worked_example_under_app_ayanamsa():
    configure_ayanamsa(drik)
    jd, place = _textbook_birth()

    for star_position, expected_lord, expected_balance in _TEXTBOOK_CASES:
        vim_balance, dashas = vimsottari.get_vimsottari_dhasa_bhukthi(
            jd,
            place,
            star_position_from_moon=star_position,
            dhasa_level_index=const.MAHA_DHASA_DEPTH.MAHA_DHASA_ONLY,
        )
        actual_lord = dashas[0][0][0]
        assert (actual_lord, tuple(vim_balance)) == (expected_lord, expected_balance)


def test_vimsottari_mahadasha_covers_full_120_year_cycle():
    configure_ayanamsa(drik)
    jd, place = _textbook_birth()

    _vim_balance, dashas = vimsottari.get_vimsottari_dhasa_bhukthi(
        jd, place, dhasa_level_index=const.MAHA_DHASA_DEPTH.MAHA_DHASA_ONLY
    )
    assert len(dashas) == 9
    lords = {entry[0][0] for entry in dashas}
    assert lords == set(range(9))  # Sun..Ketu, each exactly once
    total_years = sum(entry[2] for entry in dashas)
    assert total_years == pytest.approx(const.human_life_span_for_vimsottari_dhasa, abs=0.01)


def test_running_dhasa_for_birth_date_is_active_at_birth():
    configure_ayanamsa(drik)
    jd, place = _textbook_birth()

    # The dhasa active exactly at birth must be the birth Mahadasha lord.
    _vim_balance, dashas = vimsottari.get_vimsottari_dhasa_bhukthi(
        jd, place, dhasa_level_index=const.MAHA_DHASA_DEPTH.MAHA_DHASA_ONLY
    )
    running = vimsottari.get_running_dhasa_for_given_date(
        jd, jd, place, dhasa_level_index=const.MAHA_DHASA_DEPTH.MAHA_DHASA_ONLY
    )
    assert running[0][0][0] == dashas[0][0][0]

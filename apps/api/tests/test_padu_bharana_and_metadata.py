from datetime import date, time

from app.modules.pancha_pakshi.enums import BirdId
from app.modules.pancha_pakshi.models import EngineMetadata
from app.modules.pancha_pakshi.service import schedule_from_bird

_ENGINE = EngineMetadata(
    version="4.8.7", commit="ca22995709bd60e371e7820a1a5efc80ce4cf821",
    csv_checksum="test-csv-checksum", ephemeris_manifest_checksum="test-ephe-checksum", deployed_commit="test-sha",
)


def test_padu_pakshi_constant_within_a_schedule():
    sched = schedule_from_bird(
        BirdId.peacock, date(2026, 7, 11), time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    padu_values = {mp.padu_pakshi for mp in sched.major_periods}
    assert len(padu_values) == 1, "padu_pakshi is expected constant across all major periods for one schedule"
    assert sched.padu_pakshi == sched.major_periods[0].padu_pakshi


def test_bharana_pakshi_can_differ_between_day_and_night():
    # This is the corrected-shape finding: bharana_pakshi is NOT guaranteed
    # constant across a schedule. Search across birds/dates for at least one
    # case demonstrating day/night divergence, so a regression to "always
    # constant" handling would be caught.
    found_divergence = False
    for bird in [BirdId.vulture, BirdId.owl, BirdId.crow, BirdId.cock, BirdId.peacock]:
        sched = schedule_from_bird(
            bird, date(2026, 7, 11), time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
        )
        day_bharana = sched.major_periods[0].bharana_pakshi
        night_bharana = sched.major_periods[5].bharana_pakshi
        if day_bharana != night_bharana:
            found_divergence = True
            break
    assert found_divergence, "expected at least one bird/date combination where bharana_pakshi differs day vs night"


def test_schedule_level_padu_bharana_mirrors_first_major_period():
    sched = schedule_from_bird(
        BirdId.owl, date(2026, 7, 11), time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.padu_pakshi == sched.major_periods[0].padu_pakshi
    assert sched.bharana_pakshi == sched.major_periods[0].bharana_pakshi


def test_engine_metadata_populated():
    sched = schedule_from_bird(
        BirdId.owl, date(2026, 7, 11), time(12, 0, 0), "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.engine.name == "PyJHora"
    assert sched.engine.version == "4.8.7"
    assert sched.engine.commit == "ca22995709bd60e371e7820a1a5efc80ce4cf821"
    assert sched.engine.csv_checksum == "test-csv-checksum"
    assert sched.engine.ephemeris_manifest_checksum == "test-ephe-checksum"
    assert sched.engine.deployed_commit == "test-sha"

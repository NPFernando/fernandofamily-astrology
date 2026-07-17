import pytest

from app.modules.pancha_pakshi import repository
from app.modules.pancha_pakshi.enums import BirdId, PakshaId
from app.modules.pancha_pakshi.service import schedule_from_nakshatra_paksha
from datetime import date, time
from app.modules.pancha_pakshi.models import EngineMetadata

_ENGINE = EngineMetadata(
    version="4.8.7", commit="ca22995709bd60e371e7820a1a5efc80ce4cf821",
    csv_checksum="test", ephemeris_manifest_checksum="test", deployed_commit="test",
)

_EXPECTED = {}
for i in range(1, 6):
    _EXPECTED[i] = (BirdId.vulture, BirdId.peacock)
for i in range(6, 12):
    _EXPECTED[i] = (BirdId.owl, BirdId.cock)
for i in range(12, 17):
    _EXPECTED[i] = (BirdId.crow, BirdId.crow)
for i in range(17, 22):
    _EXPECTED[i] = (BirdId.cock, BirdId.owl)
for i in range(22, 28):
    _EXPECTED[i] = (BirdId.peacock, BirdId.vulture)


@pytest.mark.parametrize("nakshatra_index", range(1, 28))
@pytest.mark.parametrize("paksha", [PakshaId.waxing, PakshaId.waning])
def test_birth_bird_mapping_all_27_nakshatras_both_pakshas(nakshatra_index, paksha):
    expected_waxing, expected_waning = _EXPECTED[nakshatra_index]
    expected = expected_waxing if paksha == PakshaId.waxing else expected_waning
    sched = schedule_from_nakshatra_paksha(
        nakshatra_index, paksha, None, date(2026, 7, 11), time(12, 0, 0),
        "Colombo, Sri Lanka", 6.9271, 79.8612, "Asia/Colombo", _ENGINE,
    )
    assert sched.birth_bird == expected


def test_birth_bird_table_has_27_entries():
    assert len(repository.BIRTH_BIRD_TABLE) == 27

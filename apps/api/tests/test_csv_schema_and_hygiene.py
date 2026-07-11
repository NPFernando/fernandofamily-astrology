from pathlib import Path

from app.modules.pancha_pakshi import repository

_MODULE_DIR = Path(__file__).resolve().parents[1] / "app" / "modules" / "pancha_pakshi"


def test_csv_has_exactly_3500_data_rows():
    rows = repository.load_rows()
    assert len(rows) == 3500


def test_csv_header_schema():
    import csv

    with open(repository._CSV_PATH, encoding="utf-8-sig", newline="") as f:
        header = next(csv.reader(f))
    assert header == [
        "week_day_index", "paksha_index", "daynight_index", "nak_bird_index", "nak_activity_index",
        "sub_bird_index", "sub_activity_index", "duration_factor", "relation", "power_factor",
        "effect", "rating", "padu_pakshi", "bharana_pakshi",
    ]


def test_get_matching_rows_always_returns_exactly_50():
    for bird_1based in range(1, 6):
        for weekday_1based in range(1, 8):
            for paksha_1based in (1, 2):
                rows = repository.get_matching_rows(bird_1based, weekday_1based, paksha_1based)
                assert len(rows) == 50


def test_calculator_and_adapter_never_call_localized_resource_strings_or_image_paths():
    # Structural guard for the "no upstream display strings" adapter rule.
    # Checks actual usage/call patterns, not explanatory prose in comments or
    # docstrings that legitimately mention these names to document the rule.
    for filename in ("adapter.py", "calculator.py"):
        source = (_MODULE_DIR / filename).read_text()
        assert "resource_strings[" not in source, f"{filename} must not index utils.resource_strings"
        assert "set_language(" not in source, f"{filename} must not call utils.set_language"
        assert ".png" not in source, f"{filename} must not reference image paths"


def test_calculator_does_not_log_raw_inputs():
    # Defense-in-depth: this module must not import a logging facility at all,
    # since routes (Phase 3) are responsible for structured, birth-data-excluding
    # logging - the calculation layer itself should never independently log inputs.
    source = (_MODULE_DIR / "calculator.py").read_text()
    assert "import logging" not in source
    assert "print(" not in source

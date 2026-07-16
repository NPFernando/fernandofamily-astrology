import csv
import os
from pathlib import Path

from app.modules.pancha_pakshi.enums import ActivityId, BirdId, EffectId, RelationId, WeekdayId

# 0-based, mirrors upstream `pancha_pakshi_birds` (jhora/panchanga/pancha_paksha.py).
# CSV columns nak_bird_index / sub_bird_index / padu_pakshi / bharana_pakshi index into this.
BIRD_ORDER = [BirdId.vulture, BirdId.owl, BirdId.crow, BirdId.cock, BirdId.peacock]

# 0-based, mirrors upstream `pancha_pakshi_activities`.
# CSV columns nak_activity_index / sub_activity_index index into this.
ACTIVITY_ORDER = [ActivityId.ruling, ActivityId.eating, ActivityId.walking, ActivityId.sleeping, ActivityId.dying]

# 0-based, mirrors upstream `pp_relations`. CSV column `relation` indexes into this.
RELATION_ORDER = [RelationId.enemy, RelationId.same, RelationId.friend]

# 0-based, mirrors upstream `pp_effect`. CSV column `effect` indexes into this.
EFFECT_ORDER = [EffectId.very_bad, EffectId.bad, EffectId.average, EffectId.good, EffectId.very_good]

# 0-based tārā category keys, in the order `thaaraabalam()` groups its 9
# result lists (vendor/jhora/panchanga/drik.py:3518) — transcribed verbatim
# from that function's own docstring, not invented.
TARA_KEYS = [
    "paramitra", "janma", "sampatha", "vipatha", "kshema",
    "pratyaka", "sadhana", "naidhana", "mitra",
]

# Same order as TARA_KEYS. The classical labels (Good/Not Good/Very Good/Bad/
# Totally Bad) map one-for-one onto the existing EffectId scale already used
# for Pancha Pakshi sub-periods — "Not Good" is the closest existing bucket
# to "average" (a mild, non-catastrophic caution, not a positive rating).
TARA_EFFECT_ORDER = [
    EffectId.good,       # 0 Paramitra
    EffectId.average,    # 1 Janma      (Not Good)
    EffectId.very_good,  # 2 Sampatha
    EffectId.bad,        # 3 Vipatha
    EffectId.good,       # 4 Kshema
    EffectId.average,    # 5 Pratyaka   (Not Good)
    EffectId.very_good,  # 6 Sadhana
    EffectId.very_bad,   # 7 Naidhana   (Totally Bad)
    EffectId.good,       # 8 Mitra
]

# 0-based cardinal direction keys, matching the comment directly above
# upstream's disha_shool_map (vendor/jhora/const.py:1275): "0=East, 1=South,
# 2=West, 3=North".
DISHA_KEYS = ["east", "south", "west", "north"]

# 0-based, matches drik.vaara()'s return value directly (0=Sunday..6=Saturday).
WEEKDAY_ORDER = [
    WeekdayId.sunday,
    WeekdayId.monday,
    WeekdayId.tuesday,
    WeekdayId.wednesday,
    WeekdayId.thursday,
    WeekdayId.friday,
    WeekdayId.saturday,
]

# 27-entry table transcribed verbatim from upstream `pancha_pakshi_stars_birds_paksha`
# (jhora/panchanga/pancha_paksha.py). Each tuple is (waxing_bird_1based, waning_bird_1based),
# 1-based bird numbers: 1=vulture, 2=owl, 3=crow, 4=cock, 5=peacock.
BIRTH_BIRD_TABLE: list[tuple[int, int]] = (
    [(1, 5)] * 5  # nakshatras 1-5
    + [(2, 4)] * 6  # nakshatras 6-11
    + [(3, 3)] * 5  # nakshatras 12-16
    + [(4, 2)] * 5  # nakshatras 17-21
    + [(5, 1)] * 6  # nakshatras 22-27
)
assert len(BIRTH_BIRD_TABLE) == 27

_VENDOR_DIR = Path(os.environ.get("FF_VENDOR_DIR") or Path(__file__).resolve().parents[3] / "vendor")
_CSV_PATH = _VENDOR_DIR / "jhora" / "data" / "pancha_pakshi_db.csv"

_EXPECTED_COLUMNS = [
    "week_day_index",
    "paksha_index",
    "daynight_index",
    "nak_bird_index",
    "nak_activity_index",
    "sub_bird_index",
    "sub_activity_index",
    "duration_factor",
    "relation",
    "power_factor",
    "effect",
    "rating",
    "padu_pakshi",
    "bharana_pakshi",
]

_rows_cache: list[list[float]] | None = None


def _to_num(value: str) -> float:
    value = value.strip()
    if "." in value or "e" in value.lower():
        return float(value)
    return int(value)


def load_rows() -> list[list[float]]:
    global _rows_cache
    if _rows_cache is not None:
        return _rows_cache
    with open(_CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        assert header == _EXPECTED_COLUMNS, f"unexpected CSV header: {header}"
        rows = [[_to_num(v) for v in row] for row in reader if row]
    assert len(rows) == 3500, f"expected 3500 data rows, got {len(rows)}"
    _rows_cache = rows
    return rows


def get_matching_rows(bird_1based: int, weekday_1based: int, paksha_1based: int) -> list[list[float]]:
    target_bird = bird_1based - 1
    target_week = weekday_1based - 1
    target_paksha = paksha_1based - 1
    rows = load_rows()
    matched = [
        row
        for row in rows
        if int(row[3]) == target_bird and int(row[0]) == target_week and int(row[1]) == target_paksha
    ]
    if len(matched) != 50:
        raise AssertionError(
            f"expected exactly 50 matching rows for bird={bird_1based} weekday={weekday_1based} "
            f"paksha={paksha_1based}, got {len(matched)}"
        )
    return matched

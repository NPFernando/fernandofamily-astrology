"""Generates golden fixtures for the Pancha Pakshi calculator from the vendored
upstream PyJHora engine directly (bypassing app.modules.pancha_pakshi so the
fixtures are independent ground truth, not a reflection of our own code).

For each case, replicates upstream's own before-sunrise rollback + weekday/paksha
resolution (jhora.panchanga.pancha_paksha.construct_pancha_pakshi_information's
documented sequence) using only vendored jhora primitives, then queries the raw
matching CSV rows directly via get_matching_pancha_pakshi_data_from_db. Also
calls construct_pancha_pakshi_information itself as a sanity check that it runs
without error for the same inputs.

Run: python scripts/dev/generate_golden_fixtures.py
"""
import json
import sys
from pathlib import Path

_VENDOR_PATH = str(Path(__file__).resolve().parents[2] / "vendor")
if _VENDOR_PATH not in sys.path:
    sys.path.insert(0, _VENDOR_PATH)

from jhora import utils  # noqa: E402
from jhora.panchanga import drik, pancha_paksha  # noqa: E402

utils.set_language("en")

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "tests" / "golden" / "fixtures"
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

CASES = [
    # (case_id, y, m, d, hh, mm, ss, place_name, lat, lon, tz_hours, bird_1based)
    ("waxing_vulture_colombo", 2026, 7, 11, 12, 0, 0, "Colombo, Sri Lanka", 6.9271, 79.8612, 5.5, 1),
    ("waning_owl_chennai", 2026, 3, 15, 9, 30, 0, "Chennai, India", 13.0878, 80.2785, 5.5, 2),
    ("waxing_crow_newyork", 2026, 6, 1, 14, 0, 0, "New York, USA", 40.7128, -74.0060, -4.0, 3),
    ("waning_cock_london", 2026, 11, 20, 8, 0, 0, "London, UK", 51.5074, -0.1278, 0.0, 4),
    ("waxing_peacock_sydney", 2026, 9, 5, 18, 0, 0, "Sydney, Australia", -33.8688, 151.2093, 10.0, 5),
    # DST-transition-adjacent date (America/New_York spring-forward is 2026-03-08; EST=-5 applies pre-transition)
    ("dst_transition_newyork", 2026, 3, 8, 3, 0, 0, "New York, USA", 40.7128, -74.0060, -5.0, 3),
    # Leap day
    ("leap_day_colombo", 2028, 2, 29, 10, 0, 0, "Colombo, Sri Lanka", 6.9271, 79.8612, 5.5, 5),
]


def resolve(y, m, d, hh, mm, ss, place):
    jd = utils.julian_day_number(drik.Date(y, m, d), (hh, mm, ss))
    sunrise_jd = drik.sunrise(jd, place)[-1]
    if jd < sunrise_jd:
        jd -= 1
        sunrise_jd = drik.sunrise(jd, place)[-1]
    weekday_index = drik.vaara(jd, place) + 1
    paksha_index = pancha_paksha._get_paksha(jd, place)
    return jd, sunrise_jd, weekday_index, paksha_index


def main():
    for case_id, y, m, d, hh, mm, ss, name, lat, lon, tz_hours, bird_1based in CASES:
        place = drik.Place(name, lat, lon, tz_hours)
        jd, sunrise_jd, weekday_index, paksha_index = resolve(y, m, d, hh, mm, ss, place)

        # Sanity check: upstream's own reference function must run without error
        # for these exact inputs.
        pancha_paksha.construct_pancha_pakshi_information(
            dob=drik.Date(y, m, d), tob=(hh, mm, ss), place=place, nakshathra_bird_index=bird_1based
        )

        rows = pancha_paksha.get_matching_pancha_pakshi_data_from_db(bird_1based, weekday_index, paksha_index)
        assert len(rows) == 50, f"{case_id}: expected 50 rows, got {len(rows)}"

        day_length = drik.day_length(jd, place)
        night_length = drik.night_length(jd, place)

        fixture = {
            "case_id": case_id,
            "input": {
                "year": y, "month": m, "day": d, "hour": hh, "minute": mm, "second": ss,
                "location_name": name, "latitude": lat, "longitude": lon, "tz_hours": tz_hours,
                "bird_1based": bird_1based,
            },
            "resolved": {
                "weekday_index_1based": weekday_index,
                "paksha_index_1based": paksha_index,
                "sunrise_jd": sunrise_jd,
                "day_length_hours": day_length,
                "night_length_hours": night_length,
            },
            "rows": rows,
        }
        out_path = FIXTURES_DIR / f"{case_id}.json"
        out_path.write_text(json.dumps(fixture, indent=2))
        print(f"wrote {out_path} ({len(rows)} rows)")


if __name__ == "__main__":
    main()

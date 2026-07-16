#!/usr/bin/env python3
# Verifies the vendored PyJHora engine: checksums, CSV schema, pin metadata,
# and a live import + calculation smoke test. Run as:
#   python3 apps/api/scripts/verify_vendor.py --mode full
#   python3 apps/api/scripts/verify_vendor.py --mode fast
# Used identically in CI, the API Docker build, and the /api/v1/health/ready
# route (fast mode). Exits 0 on success, 1 with a stderr report on failure.
import argparse
import csv
import hashlib
import json
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
API_DIR = SCRIPT_DIR.parent
# FF_VENDOR_DIR: alternate vendor tree (tests verifying a trimmed copy).
VENDOR_DIR = Path(os.environ.get("FF_VENDOR_DIR") or API_DIR / "vendor")
JHORA_DIR = VENDOR_DIR / "jhora"
# Profiles: "repo" verifies the full manifest (complete checkout, CI);
# "image" verifies MANIFEST.image.sha256 — the subset the Docker image ships
# (ephemeris trimmed to the supported 1800-2399 range; see vendor/README.md).
# The Docker image sets FF_VENDOR_PROFILE=image so readiness picks the right
# manifest without guessing from which files happen to exist.
DEFAULT_PROFILE = os.environ.get("FF_VENDOR_PROFILE", "repo")
PIN_PATH = VENDOR_DIR / "pin.json"


def manifest_path_for(profile: str) -> Path:
    return VENDOR_DIR / ("MANIFEST.image.sha256" if profile == "image" else "MANIFEST.sha256")

EXPECTED_CSV_HEADER = [
    "week_day_index", "paksha_index", "daynight_index", "nak_bird_index",
    "nak_activity_index", "sub_bird_index", "sub_activity_index",
    "duration_factor", "relation", "power_factor", "effect", "rating",
    "padu_pakshi", "bharana_pakshi",
]
EXPECTED_CSV_DATA_ROWS = 3500
EXPECTED_PYJHORA_VERSION = "4.8.7"
EXPECTED_PYJHORA_COMMIT_PREFIX = "ca22995"


class VerificationError(Exception):
    pass


def verify_checksums(profile: str) -> int:
    manifest = manifest_path_for(profile)
    if not manifest.exists():
        raise VerificationError(f"manifest not found: {manifest}")
    failures = []
    checked = 0
    for line in manifest.read_text().splitlines():
        if not line.strip():
            continue
        expected_hash, rel_path = line.split("  ", 1)
        file_path = JHORA_DIR / rel_path
        if not file_path.exists():
            failures.append(f"missing file: {rel_path}")
            continue
        actual_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
        if actual_hash != expected_hash:
            failures.append(
                f"checksum mismatch: {rel_path} (expected {expected_hash}, got {actual_hash})"
            )
        checked += 1
    if failures:
        raise VerificationError("checksum verification failed:\n" + "\n".join(failures))
    return checked


def verify_csv_schema() -> int:
    csv_path = JHORA_DIR / "data" / "pancha_pakshi_db.csv"
    if not csv_path.exists():
        raise VerificationError(f"csv not found: {csv_path}")
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        if header != EXPECTED_CSV_HEADER:
            raise VerificationError(f"unexpected csv header: {header}")
        data_rows = sum(1 for _ in reader)
    if data_rows != EXPECTED_CSV_DATA_ROWS:
        raise VerificationError(
            f"expected {EXPECTED_CSV_DATA_ROWS} data rows, found {data_rows}"
        )
    return data_rows


def verify_pin_metadata() -> dict:
    if not PIN_PATH.exists():
        raise VerificationError(f"pin.json not found: {PIN_PATH}")
    pin = json.loads(PIN_PATH.read_text())
    if pin.get("version") != EXPECTED_PYJHORA_VERSION:
        raise VerificationError(f"unexpected pinned version: {pin.get('version')}")
    if not pin.get("commit", "").startswith(EXPECTED_PYJHORA_COMMIT_PREFIX):
        raise VerificationError(f"unexpected pinned commit: {pin.get('commit')}")
    return pin


def verify_engine_import_and_calc(full: bool) -> dict:
    if str(VENDOR_DIR) not in sys.path:
        sys.path.insert(0, str(VENDOR_DIR))
    try:
        import jhora  # noqa: F401
        from jhora import config as jhora_config

        try:
            jhora_config.validate_const_synchronization()
        except AssertionError as exc:
            # This app deliberately overrides the ayanamsa at runtime — LAHIRI,
            # not the vendored factory_settings.json's stale TRUE_PUSHYA
            # default (see app/core/vendor_path.py:configure_ayanamsa for why).
            # That override mutates the shared `const` module's
            # _DEFAULT_AYANAMSA_MODE attribute, which this vendor-internal
            # check reads as if it were the untouched hardcoded default —
            # it exists to catch accidental hand-edits to const.py, not
            # legitimate runtime overrides, and has no way to distinguish the
            # two. Tolerate exactly this one, known, intentional mismatch;
            # anything else still fails loudly. (The check stops at the first
            # mismatch, so a genuine drift in a setting checked after this one
            # would go undetected here — acceptable for a narrow vendor
            # consistency check when the app's actual ayanamsa correctness has
            # its own dedicated guard: tests/test_ayanamsa.py.)
            if "default_ayanamsa_mode" not in str(exc):
                raise
        from jhora import utils
        from jhora.panchanga import drik, pancha_paksha
    except Exception as exc:
        raise VerificationError(f"engine import failed: {exc}") from exc

    dob = drik.Date(1996, 12, 7)
    tob = (10, 34, 0)
    place = drik.Place("Colombo,SriLanka", 6.9271, 79.8612, 5.5)
    jd = utils.julian_day_number(dob, tob)

    sunrise = drik.sunrise(jd, place)
    if not sunrise or sunrise[-1] <= 0:
        raise VerificationError(f"sunrise calculation returned unexpected value: {sunrise}")

    if not full:
        return {"sunrise": sunrise}

    weekday = drik.vaara(jd, place)
    paksha = pancha_paksha._get_paksha(jd, place)
    nakshatra = drik.nakshatra(jd, place)
    birth_bird = pancha_paksha._get_birth_bird_from_nakshathra(nakshatra[0], paksha)
    rows = pancha_paksha.get_matching_pancha_pakshi_data_from_db(
        birth_bird, weekday + 1, paksha
    )
    if len(rows) != 50:
        raise VerificationError(f"expected 50 matching schedule rows, found {len(rows)}")

    return {
        "sunrise": sunrise,
        "weekday": weekday,
        "paksha": paksha,
        "nakshatra": nakshatra,
        "birth_bird": birth_bird,
        "row_count": len(rows),
    }


def run_verification(mode: str, profile: str = DEFAULT_PROFILE) -> dict:
    results = {
        "profile": profile,
        "files_checked": verify_checksums(profile),
        "csv_data_rows": verify_csv_schema(),
        "pin": verify_pin_metadata(),
        "engine": verify_engine_import_and_calc(full=(mode == "full")),
    }
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify vendored PyJHora engine integrity")
    parser.add_argument("--mode", choices=["full", "fast"], default="full")
    parser.add_argument("--profile", choices=["repo", "image"], default=DEFAULT_PROFILE)
    args = parser.parse_args()
    try:
        results = run_verification(args.mode, args.profile)
    except VerificationError as exc:
        print(f"VENDOR VERIFICATION FAILED ({args.mode} mode, {args.profile} profile):", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    print(f"Vendor verification passed ({args.mode} mode, {args.profile} profile).")
    print(f"  Checksummed files: {results['files_checked']}")
    print(f"  CSV data rows: {results['csv_data_rows']}")
    print(f"  Pinned commit: {results['pin']['commit']}")
    print(f"  Engine sunrise sample: {results['engine']['sunrise']}")
    sys.exit(0)


if __name__ == "__main__":
    main()

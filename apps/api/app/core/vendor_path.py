import os
import sys
from pathlib import Path


def ensure_vendor_on_path() -> str:
    """Put the vendored PyJHora tree on sys.path (idempotent) and return it.

    FF_VENDOR_DIR overrides where the vendored engine lives — used by tests to
    point at an ephemeris-trimmed copy of the tree, mirroring what the Docker
    image ships (see infra/docker/Dockerfile.api and vendor/README.md). Shared
    by every module adapter that imports `jhora` so the override behaves
    identically across features.
    """
    vendor_path = os.environ.get("FF_VENDOR_DIR") or str(Path(__file__).resolve().parents[2] / "vendor")
    if vendor_path not in sys.path:
        sys.path.insert(0, vendor_path)
    return vendor_path


def configure_ayanamsa(drik_module) -> None:
    """Explicitly pin the sidereal ayanamsa this whole app computes with.

    Upstream's `set_ayanamsa_mode("TRUE_PUSHYA")` call in drik.py lives inside
    an `if __name__ == "__main__":` guard, so it never runs on import — every
    prior release of this app silently ran on swisseph's own compiled-in
    default (Fagan-Bradley) instead of either upstream's stated TRUE_PUSHYA
    default or this app's own docs, which claimed Lahiri. Neither prior claim
    was actually running.

    LAHIRI is correct: the Sun's tropical-to-sidereal crossing (0 degrees,
    Mesha Sankranti) it produces matches the Sri Lankan State Astrologers'
    Committee's officially published "New Year dawns" instant to within one
    minute in 2024, 2025, and 2026 (the committee's separately-published
    Nonagathaya/Punya Kaalaya start and end times bracket that instant
    symmetrically — their midpoint IS the published dawn time, confirmed
    across all three years). Fagan-Bradley misses by roughly a full day;
    TRUE_CITRA (the "TRUE_LAHIRI" entry in const.available_ayanamsa_modes is
    actually mapped to this, not to plain Lahiri — a naming trap) is ~15
    minutes off. See scripts/dev/ayanamsa_newyear_check.py for the derivation
    and docs/calculations/panchanga.md for the full validation writeup.

    Called twice, and both call sites matter — this was empirically
    confirmed, not assumed:

    1. Here, at adapter import time (main/import thread). Covers callers
       that reach the calculator directly without going through a request —
       e.g. tests/test_poya.py calls calculator._sinhala_month_at() straight,
       with no HTTP request in the picture at all.
    2. Each adapter also exposes `ensure_ayanamsa()`, called as the first
       statement inside `resolve_effective_jd` (pancha_pakshi) and
       `compute_daily_panchanga` (panchanga) — the choke points every actual
       request passes through.

    Site 1 alone is not enough: setting this once at import time measurably
    did NOT carry through to an actual FastAPI request under Starlette's
    TestClient — a request handled after import still read swisseph's
    Fagan-Bradley default, confirmed by reading `swe.get_ayanamsa_ut()` at
    both points and seeing 25.11 degrees (Fagan) instead of the 24.23
    degrees (Lahiri) set moments earlier at import. The threadpool
    mechanism, originally only the leading suspect, is now CONFIRMED (for
    the ephemeris path at least): pyswisseph keeps per-thread state, so a
    bare ThreadPoolExecutor worker that never called `set_ephe_path` fails
    `swe.fixstar_ut` with "sefstars.txt not found" using swisseph's default
    search path, while the same call succeeds after setting the path inside
    that worker — reproduced minimally during the yogatara feature build.
    Site 2 alone is also not enough, as test_poya.py's direct calls prove.
    Keep both.

    The same per-thread reset now covers the ephemeris path too: planetary
    `swe.calc_ut` degrades gracefully to built-in Moshier positions when the
    ephemeris files aren't visible (which is plausibly the root cause of the
    documented cross-thread arcsecond drift in test_birth_chart.py), but
    `swe.fixstar_ut` hard-fails without sefstars.txt, so worker threads must
    re-set the path exactly like they re-set the ayanamsa.
    """
    const = drik_module.const  # jhora.const, already imported by drik
    const.swe.set_ephe_path(const._ephe_path)
    drik_module.set_ayanamsa_mode("LAHIRI")

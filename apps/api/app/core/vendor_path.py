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

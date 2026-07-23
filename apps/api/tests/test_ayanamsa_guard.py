"""Static regression guard: every module that touches the ephemeris must
call ensure_ayanamsa() somewhere in its own source, so a new module can't
silently regress to swisseph's Fagan-Bradley default (see
app.core.vendor_path.configure_ayanamsa's docstring for why this matters
— pyswisseph keeps per-thread ayanamsa state, and a forgotten call
produces wrong charts with no error at all).
"""
from pathlib import Path

MODULES_DIR = Path(__file__).parent.parent / "app" / "modules"

_EPHEMERIS_TOUCH_MARKERS = (
    "configure_ayanamsa(drik)",
    "from app.modules.pancha_pakshi import adapter as pp_adapter",
    "from app.modules.pancha_pakshi.adapter import",
)


def _module_dirs():
    return sorted(
        p for p in MODULES_DIR.iterdir() if p.is_dir() and not p.name.startswith("__")
    )


def test_every_ephemeris_touching_module_calls_ensure_ayanamsa():
    missing = []
    for module_dir in _module_dirs():
        sources = {f: f.read_text() for f in module_dir.glob("*.py")}
        touches_ephemeris = any(
            marker in text for text in sources.values() for marker in _EPHEMERIS_TOUCH_MARKERS
        )
        if not touches_ephemeris:
            continue
        calls_ensure = any("ensure_ayanamsa()" in text for text in sources.values())
        if not calls_ensure:
            missing.append(module_dir.name)
    assert not missing, (
        f"module(s) {missing} import an ephemeris adapter but never call "
        "ensure_ayanamsa() anywhere in their own source — a new request path "
        "here would silently compute charts with swisseph's default ayanamsa "
        "(Fagan-Bradley) instead of the configured Lahiri mode."
    )

"""Sole boundary permitted to import vendored `jhora` for this module —
thin pass-throughs only, no enums, no business logic.

`build_house_to_planet_list` is the one function here that isn't a pure
1:1 vendor call — it adapts this app's existing (planet_id, (constellation,
long_in_raasi)) raw-D1 shape (already produced by every other module via
`dhasavarga(jd, place, 1)`) into the `['','','','','2','7','1/5','0',...]`
house-string format `jhora.horoscope.chart.ashtakavarga.get_ashtaka_varga`
expects, by delegating to the vendored
`utils.get_house_planet_list_from_planet_positions` (already vendored,
already used for exactly this shape elsewhere in `jhora`) rather than
reimplementing that formatting logic. Classical Ashtakavarga is a
7-graha (Sun..Saturn) + Lagna system, so Ketu(8) is dropped here — but
Rahu(7) is deliberately KEPT despite never being a real Ashtakavarga
contributor: `get_ashtaka_varga`'s own inner loop does
`pr = p_to_h[op]` unconditionally before its `if op == 7: pr =
p_to_h[Lagna]` override, so `p_to_h[7]` must exist (even though its
value is immediately discarded for op==7) or the vendored function
raises `KeyError` before ever reaching that override — confirmed by
reproducing the crash with Rahu filtered out."""
from app.core.vendor_path import configure_ayanamsa, ensure_vendor_on_path

ensure_vendor_on_path()

from jhora import utils  # noqa: E402
from jhora.horoscope.chart import ashtakavarga as jhora_ashtakavarga  # noqa: E402
from jhora.panchanga import drik  # noqa: E402

configure_ayanamsa(drik)

_RAHU_ID = 7  # kept in the chart (see module docstring); Ketu(8) is dropped
_KETU_ID = 8


def ensure_ayanamsa() -> None:
    """Call at the top of every calculator entry point — see
    configure_ayanamsa's docstring for why the import-time call above isn't
    sufficient on its own."""
    configure_ayanamsa(drik)


def dhasavarga(jd: float, p, divisional_chart_factor: int) -> list:
    """[(planet_id 0..8, (constellation 0..11, long_in_raasi)), ...] —
    divisional_chart_factor=1 is the identity D1/Rasi projection, same
    primitive every other divisional-chart module in this app uses."""
    return drik.dhasavarga(jd, p, divisional_chart_factor=divisional_chart_factor)


def ascendant_rashi_raw(jd: float, p) -> tuple[int, float]:
    """(constellation 0..11, degrees within that rashi 0..30) of the
    Ascendant/Lagna, D1/Rasi."""
    constellation, coordinates, _nak_no, _paadha_no = drik.ascendant(jd, p)
    return constellation, coordinates


def build_house_to_planet_list(raw_d1_placements: list) -> list[str]:
    sun_to_rahu = [
        (planet_id, position) for planet_id, position in raw_d1_placements if planet_id != _KETU_ID
    ]
    return utils.get_house_planet_list_from_planet_positions(sun_to_rahu)


def get_ashtaka_varga(house_to_planet_list: list[str]) -> tuple[list, list, list]:
    """(binna_ashtaka_varga [0..7][0..11], samudhaya_ashtaka_varga [0..11],
    prastara_ashtaka_varga [0..7][0..8][0..11]) — see
    jhora.horoscope.chart.ashtakavarga.get_ashtaka_varga's own docstring."""
    return jhora_ashtakavarga.get_ashtaka_varga(house_to_planet_list)

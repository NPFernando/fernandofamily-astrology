"""The 27 yogataras (junction stars) of the nakshatras — pinned mapping.

Source: Report of the Calendar Reform Committee (Government of India, 1955),
Table 5 "Stars of the Naksatra divisions", the same document whose Chitra
(= Spica / alpha Virginis) anchor defines the Lahiri ayanamsa this entire
app is pinned to (see app/core/vendor_path.py and
docs/calculations/panchanga.md). The yogatara concept itself is classical:
Surya Siddhanta ch. 8 ("On the Conjunction of Planets with the Stars",
Burgess translation) tabulates these star positions.

Identification notes (documented divergences, resolved by pinning CRC):

- Ashlesha: CRC gives alpha Cancri (Acubens); some modern lists use
  epsilon Hydrae. The vendored sefstars.txt's own "Ashlesha (Colebrook)"
  alias also points to alpha Cancri, agreeing with CRC.
- Vishakha: CRC gives alpha Librae (+0 deg 20 min latitude, i.e. the bright
  alpha-2 component, Zubenelgenubi — verified: alpha-2's ecliptic latitude
  +0.333 deg matches CRC to the arcminute; iota-1's -1.85 deg does not).
  The sefstars.txt "Vishakha" alias points to iota-1 Librae instead — that
  alias is deliberately NOT used here.
- Shatabhisha: CRC gives lambda Aquarii; some popular summaries (e.g. the
  Wikipedia nakshatra list) show gamma Aquarii.
- CRC itself notes (same page as Table 5) that seven yogataras — Ardra,
  Svati, Jyeshtha, Purva Ashadha, Uttara Ashadha, Shravana, Dhanishta —
  fall OUTSIDE the equal 13 deg 20 min nakshatra division bearing their
  name. This is a property of the sky, documented since the Siddhantas; the
  UI shows star positions as they are rather than forcing them into their
  divisions.

Search keys are Swiss Ephemeris sefstars.txt nomenclature (",<bayer><IAU
constellation abbreviation>"), resolved against the vendored catalog —
every entry verified to resolve via swe.fixstar_ut with an ecliptic
latitude matching CRC Table 5's printed latitude to well under a degree
(tests/test_yogatara.py locks this in). Keys are ordered by and named
after panchanga.repository.NAKSHATRA_KEYS.
"""

# (nakshatra_key, sefstars.txt search key, human label for docs/logs)
YOGATARA_STARS: list[tuple[str, str, str]] = [
    ("ashwini", ",beAri", "beta Arietis (Sheratan)"),
    ("bharani", ",41Ari", "41 Arietis"),
    ("krittika", ",etTau", "eta Tauri (Alcyone)"),
    ("rohini", ",alTau", "alpha Tauri (Aldebaran)"),
    ("mrigashirsha", ",laOri", "lambda Orionis (Meissa)"),
    ("ardra", ",alOri", "alpha Orionis (Betelgeuse)"),
    ("punarvasu", ",beGem", "beta Geminorum (Pollux)"),
    ("pushya", ",deCnc", "delta Cancri (Asellus Australis)"),
    ("ashlesha", ",alCnc", "alpha Cancri (Acubens)"),
    ("magha", ",alLeo", "alpha Leonis (Regulus)"),
    ("purva-phalguni", ",deLeo", "delta Leonis (Zosma)"),
    ("uttara-phalguni", ",beLeo", "beta Leonis (Denebola)"),
    ("hasta", ",deCrv", "delta Corvi (Algorab)"),
    ("chitra", ",alVir", "alpha Virginis (Spica)"),
    ("swati", ",alBoo", "alpha Bootis (Arcturus)"),
    ("vishakha", ",al-2Lib", "alpha-2 Librae (Zubenelgenubi)"),
    ("anuradha", ",deSco", "delta Scorpii (Dschubba)"),
    ("jyeshtha", ",alSco", "alpha Scorpii (Antares)"),
    ("mula", ",laSco", "lambda Scorpii (Shaula)"),
    ("purva-ashadha", ",deSgr", "delta Sagittarii (Kaus Media)"),
    ("uttara-ashadha", ",siSgr", "sigma Sagittarii (Nunki)"),
    ("shravana", ",alAql", "alpha Aquilae (Altair)"),
    ("dhanishtha", ",beDel", "beta Delphini (Rotanev)"),
    ("shatabhisha", ",laAqr", "lambda Aquarii (Hydor)"),
    ("purva-bhadrapada", ",alPeg", "alpha Pegasi (Markab)"),
    ("uttara-bhadrapada", ",gaPeg", "gamma Pegasi (Algenib)"),
    ("revati", ",zePsc", "zeta Piscium (Revati)"),
]

# CRC 1955 Table 5 column (3): ecliptic latitude of each junction star, in
# decimal degrees. Latitude is nearly epoch-independent (unlike longitude,
# which precesses), so these printed 1956 values double as identity goldens:
# tests assert the star each search key resolves to has this latitude.
CRC_LATITUDES: dict[str, float] = {
    "ashwini": 8.48, "bharani": 10.45, "krittika": 4.05, "rohini": -5.47,
    "mrigashirsha": -13.37, "ardra": -16.03, "punarvasu": 6.68,
    "pushya": 0.08, "ashlesha": -5.08, "magha": 0.47,
    "purva-phalguni": 14.33, "uttara-phalguni": 12.27, "hasta": -12.2,
    "chitra": -2.05, "swati": 30.77, "vishakha": 0.33, "anuradha": -1.98,
    "jyeshtha": -4.57, "mula": -13.78, "purva-ashadha": -6.47,
    "uttara-ashadha": -3.45, "shravana": 29.3, "dhanishtha": 31.92,
    "shatabhisha": -0.38, "purva-bhadrapada": 19.4,
    "uttara-bhadrapada": 12.6, "revati": -0.22,
}

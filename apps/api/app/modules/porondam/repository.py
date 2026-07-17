"""Classification tables for the 6 Porondama this app ships.

These are the classical, cross-tradition Ashtakoot / Tamil Thirumana
Porutham tables (widely published, not specific to any single vendored
source) — NOT independently verified against a specific Sri Lankan
source the way ayanamsa/Poya/eclipses were this session. Indices are
1-based, matching panchanga.repository.NAKSHATRA_KEYS (1..27, Ashwini
first) and panchanga.repository.RASHI_KEYS (1..12, Mesha first).
"""

# --- Gana Porondama: 27 nakshatras -> 3 temperament groups ------------------
GANA_KEYS: list[str] = ["deva", "manushya", "rakshasa"]

# 0=deva, 1=manushya, 2=rakshasa, index i = nakshatra (i+1).
GANA_BY_NAKSHATRA: list[int] = [
    0, 1, 2, 1, 0, 1, 0, 0, 2, 2,  # 1..10
    1, 1, 0, 2, 0, 2, 0, 2, 2, 1,  # 11..20
    1, 0, 2, 2, 1, 1, 0,           # 21..27
]


def gana_compatible(gana_a: int, gana_b: int) -> bool:
    """Deva-Deva, Manushya-Manushya, Rakshasa-Rakshasa (same group) and
    Deva-Manushya all pass; any pairing involving Rakshasa with a
    different group (Manushya-Rakshasa, Deva-Rakshasa) fails — the
    standard simplified pass/fail rule cited across Ashtakoot sources."""
    if gana_a == gana_b:
        return True
    return {gana_a, gana_b} == {0, 1}  # deva + manushya


# --- Yoni Porondama: 27 nakshatras -> 14 animal types -----------------------
YONI_KEYS: list[str] = [
    "horse", "elephant", "sheep", "serpent", "dog", "cat", "rat",
    "cow", "buffalo", "tiger", "deer", "monkey", "mongoose", "lion",
]

# index i = nakshatra (i+1) -> index into YONI_KEYS.
YONI_BY_NAKSHATRA: list[int] = [
    0, 1, 2, 3, 3, 4, 5, 2, 5, 6,   # 1..10  (horse,elephant,sheep,serpent,serpent,dog,cat,sheep,cat,rat)
    6, 7, 8, 9, 8, 9, 10, 10, 4, 11,  # 11..20 (rat,cow,buffalo,tiger,buffalo,tiger,deer,deer,dog,monkey)
    12, 11, 13, 0, 13, 7, 1,        # 21..27 (mongoose,monkey,lion,horse,lion,cow,elephant)
]

# The 7 classical natural-enemy yoni pairs (14 yonis pair up exactly). Any
# other combination (same yoni, or a non-enemy pairing) passes.
YONI_ENEMY_PAIRS: frozenset[frozenset[str]] = frozenset(
    {
        frozenset({"horse", "buffalo"}),
        frozenset({"elephant", "lion"}),
        frozenset({"sheep", "monkey"}),
        frozenset({"serpent", "mongoose"}),
        frozenset({"dog", "deer"}),
        frozenset({"rat", "cat"}),
        frozenset({"cow", "tiger"}),
    }
)


def yoni_compatible(yoni_a: str, yoni_b: str) -> bool:
    return frozenset({yoni_a, yoni_b}) not in YONI_ENEMY_PAIRS


# --- Rashi (Bhakoot) Porondama: pure rashi-distance arithmetic --------------
# Classical "Bhakoot dosha" distances (both directions always sum to 14, so
# checking one direction against this set already captures both) — 2nd/12th,
# 5th/9th, 6th/8th positions from each other are inauspicious.
BHAKOOT_DOSHA_DISTANCES: frozenset[int] = frozenset({2, 5, 6, 8, 9, 12})


def rashi_distance(rashi_a: int, rashi_b: int) -> int:
    """1..12, counting inclusively from rashi_a to rashi_b (wrapping)."""
    return ((rashi_b - rashi_a) % 12) + 1


def rashi_compatible(rashi_a: int, rashi_b: int) -> bool:
    return rashi_distance(rashi_a, rashi_b) not in BHAKOOT_DOSHA_DISTANCES


# --- Rashyadpathi Porondama: rashi lords + classical planetary friendship --
# index i = rashi (i+1) -> ruling planet key (panchanga.repository.GRAHA_KEYS
# naming convention).
RASHI_LORDS: list[str] = [
    "mars", "venus", "mercury", "moon", "sun", "mercury",
    "venus", "mars", "jupiter", "saturn", "saturn", "jupiter",
]

# Classical Naisargika Maitri (natural planetary friendship/enmity).
# Unlisted pairs are neutral. Not bidirectionally symmetric in every
# classical text (e.g. Moon is everyone's friend but not everyone is
# Moon's) — for a single pass/fail check here: enemy in EITHER direction
# fails; friend or neutral (i.e. not a listed enemy) passes.
_PLANET_ENEMIES: dict[str, frozenset[str]] = {
    "sun": frozenset({"venus", "saturn"}),
    "moon": frozenset(),
    "mars": frozenset({"mercury"}),
    "mercury": frozenset({"moon"}),
    "jupiter": frozenset({"mercury", "venus"}),
    "venus": frozenset({"sun", "moon"}),
    "saturn": frozenset({"sun", "moon", "mars"}),
}


def rashyadpathi_compatible(planet_a: str, planet_b: str) -> bool:
    if planet_a == planet_b:
        return True
    if planet_b in _PLANET_ENEMIES[planet_a] or planet_a in _PLANET_ENEMIES[planet_b]:
        return False
    return True


# --- Vashya Porondama: rashi -> 5 temperament groups ------------------------
VASHYA_KEYS: list[str] = ["chatushpada", "manava", "jalachara", "vanachara", "keeta"]

# index i = rashi (i+1) -> index into VASHYA_KEYS. Simplified to whole-rashi
# assignment (the classical system further subdivides Dhanu/Makara at their
# half-sign boundary; that finer distinction is not applied here).
VASHYA_BY_RASHI: list[int] = [
    0, 0, 1, 2, 3, 1, 1, 4, 0, 2, 1, 2,
]


def vashya_compatible(vashya_a: int, vashya_b: int) -> bool:
    """Simplified to same-group-only passes. The fuller classical system
    allows some cross-group combinations (e.g. chatushpada+manava under
    specific conditions); this is a deliberate simplification, not a
    complete rendering of the traditional rule."""
    return vashya_a == vashya_b

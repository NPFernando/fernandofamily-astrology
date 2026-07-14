"""Stable internal keys for panchanga elements, ordered by the upstream
1-based index conventions (display name for index i = LIST[i-1]). The API
returns these keys, never upstream display strings; bilingual names live in
the web locales keyed by these values.
"""

# Tithi 1..30: 1..15 shukla (waxing, ending at purnima), 16..30 krishna
# (waning, ending at amavasya) — matches upstream TITHI_LIST ordering.
_TITHI_NAMES = [
    "pratipada", "dvitiya", "tritiya", "chaturthi", "panchami",
    "shashthi", "saptami", "ashtami", "navami", "dashami",
    "ekadashi", "dvadashi", "trayodashi", "chaturdashi",
]
TITHI_KEYS: list[str] = (
    [f"shukla-{n}" for n in _TITHI_NAMES] + ["purnima"]
    + [f"krishna-{n}" for n in _TITHI_NAMES] + ["amavasya"]
)

# Nakshatra 1..27 — same keys as apps/web/locales/nakshatras.json so the web
# can reuse its existing bilingual name data.
NAKSHATRA_KEYS: list[str] = [
    "ashwini", "bharani", "krittika", "rohini", "mrigashirsha", "ardra",
    "punarvasu", "pushya", "ashlesha", "magha", "purva-phalguni",
    "uttara-phalguni", "hasta", "chitra", "swati", "vishakha", "anuradha",
    "jyeshtha", "mula", "purva-ashadha", "uttara-ashadha", "shravana",
    "dhanishtha", "shatabhisha", "purva-bhadrapada", "uttara-bhadrapada",
    "revati",
]

# Yoga 1..27 — upstream YOGAM_LIST order (Vishkambha..Vaidhriti).
YOGA_KEYS: list[str] = [
    "vishkambha", "priti", "ayushman", "saubhagya", "shobhana", "atiganda",
    "sukarman", "dhriti", "shula", "ganda", "vriddhi", "dhruva", "vyaghata",
    "harshana", "vajra", "siddhi", "vyatipata", "variyana", "parigha",
    "shiva", "siddha", "sadhya", "shubha", "shukla", "brahma", "indra",
    "vaidhriti",
]

# The 11 canonical karanas. Upstream karana() returns a 1..60 half-tithi
# index; the name mapping is fixed by tradition and upstream's KARANA_LIST:
# 1 = kimstughna (fixed), 2..57 = the seven movable karanas cycling in order,
# 58/59/60 = shakuni/chatushpada/naga (fixed).
KARANA_MOVABLE: list[str] = ["bava", "balava", "kaulava", "taitila", "gara", "vanija", "vishti"]
KARANA_FIXED_HEAD = "kimstughna"
KARANA_FIXED_TAIL: list[str] = ["shakuni", "chatushpada", "naga"]


def karana_key_for_index60(index60: int) -> str:
    if not (1 <= index60 <= 60):
        raise ValueError(f"karana index must be 1..60, got {index60}")
    if index60 == 1:
        return KARANA_FIXED_HEAD
    if index60 >= 58:
        return KARANA_FIXED_TAIL[index60 - 58]
    return KARANA_MOVABLE[(index60 - 2) % 7]


# Lunar months 1..12 — upstream amanta convention starting at Chaitra.
MONTH_KEYS: list[str] = [
    "chaitra", "vaishakha", "jyeshtha", "ashadha", "shravana", "bhadrapada",
    "ashvina", "kartika", "margashirsha", "pausha", "magha", "phalguna",
]

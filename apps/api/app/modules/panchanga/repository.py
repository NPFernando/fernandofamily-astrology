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

# Sinhala Poya month for each amanta month (same 1..12 index): the Sinhala
# month is the one whose Poya (purnima) falls inside that amanta month —
# Chaitra's purnima is Bak Poya, Vaishakha's is Vesak Poya, and so on.
# Spellings follow the official gazette holiday names verbatim (hence
# "nawam"/"madin", not the Sanskritized navam/medin) — validated against
# every gazetted Poya 2021-2026 in tests/fixtures/sl_poya_2021_2026.json.
SINHALA_MONTH_KEYS: list[str] = [
    "bak", "vesak", "poson", "esala", "nikini", "binara",
    "vap", "il", "unduvap", "duruthu", "nawam", "madin",
]


# Gauri Choghadiya types 0..6 — transcribed verbatim from upstream's own
# comment (vendor/jhora/const.py:1169): "0:Udveg (Bad), 1:Chara(Good),
# 2:Laabha (Good), 3:Amrit(Good), 4:Kaala(Bad), 5:Shubha (Good), 6:Rog(Bad)".
CHOGHADIYA_KEYS: list[str] = ["udveg", "chara", "laabha", "amrit", "kaala", "shubha", "rog"]
CHOGHADIYA_AUSPICIOUS: list[bool] = [False, True, True, True, False, True, False]

# Shubha Hora planet-hour rulers 0..6, in the same order as weekday index
# 0..6 (Sunday=Sun .. Saturday=Saturn) — matches upstream's own quality
# comment (const.py:1192-1193): Sun=Vigorous(Bad), Moon=Gentle(Good),
# Mars=Aggressive(Bad), Mercury=Quick(Good), Jupiter=Fruitful(Good),
# Venus=Beneficial(Good), Saturn=Sluggish(Bad) — "Moon, Mercury, Jupiter and
# Venus are good" confirms this exact assignment.
HORA_PLANET_KEYS: list[str] = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"]
HORA_AUSPICIOUS: list[bool] = [False, True, False, True, True, True, False]

# The 9 grahas, in upstream's own SUN_ID..KETU_ID order (const.py:126-137).
GRAHA_KEYS: list[str] = [
    "sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu",
]

# The 12 rashis (zodiac signs), standard order starting at Aries (Mesha).
# Deliberately independent of app/modules/birth_nakshatra's own RashiId enum
# (same values) rather than importing it — that module is a separate,
# concurrently-developed feature and panchanga shouldn't couple to it.
RASHI_KEYS: list[str] = [
    "mesha", "vrishabha", "mithuna", "karka", "simha", "kanya",
    "tula", "vrischika", "dhanu", "makara", "kumbha", "meena",
]


def sinhala_month_key(amanta_index: int, is_leap: bool) -> str:
    """Adhika (leap) months take an adhi- prefix, matching the gazette's
    "Adhi Esala Full Moon Poya Day" naming (2023 fixture)."""
    # Upstream drik.lunar_month() returns 0 for the 12th month (Phalguna,
    # i.e. Madin) rather than 12 — confirmed empirically for every Madin
    # Poya 2021-2026. Normalize before validating.
    if amanta_index == 0:
        amanta_index = 12
    if not (1 <= amanta_index <= 12):
        raise ValueError(f"amanta month index must be 1..12, got {amanta_index}")
    key = SINHALA_MONTH_KEYS[amanta_index - 1]
    return f"adhi-{key}" if is_leap else key

# Jyotishya feature ideas

A prioritized catalog of astrology-domain feature ideas for deepening Pancha
Pakshi, Daily Panchanga, and Bird Compatibility, plus genuinely new modules —
all grounded in what the pinned, vendored PyJHora V4.8.7 engine
(`apps/api/vendor/jhora/`, commit `ca22995`) can actually compute today.
Every idea below cites the real function or data file it stands on. Where the
engine can't honestly support an idea, or no verifiable source exists, that's
said plainly in Section E rather than glossed over — matching the standard
the Poya gazette validation (`docs/calculations/panchanga.md`) already set.

**A cross-cutting correctness note, found while researching this doc — now
resolved.** This doc originally flagged a discrepancy: `docs/calculations/
panchanga.md` described the module's ayanamsa as "the vendored engine's own
default (a Lahiri-family ayanamsa)," while the runtime config chain
(`apps/api/vendor/jhora/data/user_settings.json` → `"default_ayanamsa_mode":
"TRUE_PUSHYA"`, apparently loaded by `apps/api/vendor/jhora/config.py:
initialize_runtime`) suggested TRUE_PUSHYA instead. Neither turned out to be
what was actually running. Tracing the real call chain further: `config.py`'s
`initialize_runtime` is never actually invoked — `vendor/jhora/__init__.py`
references it as a bare attribute (`_config.initialize_runtime`, no `()`), a
no-op. Separately, `drik.py`'s own `set_ayanamsa_mode("TRUE_PUSHYA")` call
lives inside an `if __name__ == "__main__":` guard, equally never executed
on import. With nothing anywhere ever calling swisseph's `set_sid_mode`, the
engine silently ran on swisseph's compiled-in default the entire time:
**Fagan-Bradley** — not either previously-claimed value.

This has now been fixed and validated: the app explicitly configures
**Lahiri** (`apps/api/app/core/vendor_path.py`, `configure_ayanamsa`/
`ensure_ayanamsa`, called at both adapter-import time and at the top of
every calculator entry point — a single call site wasn't sufficient, see
that file's docstring). Lahiri was chosen because it matches the officially
published Sri Lankan New Year ("Aluth Avurudu") dawn instant — a real,
government-sourced, ayanamsa-sensitive ground truth — to within about a
minute across 2024, 2025, and 2026; see `apps/api/scripts/dev/
ayanamsa_newyear_check.py` and `docs/calculations/panchanga.md`'s Ayanamsa
section for the full derivation, and `apps/api/tests/test_ayanamsa.py` for
the regression guard. Fagan-Bradley (the accidental prior behavior) missed
by roughly a full day; TRUE_PUSHYA missed by over a day in the opposite
direction.

This resolves the ayanamsa question for every idea below that was gated on
it (flagged inline at the time this doc was written) — sidereal longitude,
rashi, and divisional-chart features can now proceed against Lahiri as a
settled, cited, cross-checked default, same as the rest of this app's
sidereal calculations.

---

## A. Deepening Pancha Pakshi

### A0. Pancha Pakshi's own provenance — researched, verdict: keep, upgrade framing

**Status: researched, no change to the feature.** Pancha Pakshi is the
platform's flagship feature and was built first, before this session's
sourcing-confidence discipline existed, so unlike every later feature it
never had its own provenance checked. Round-2 audit (`docs/roadmap.md`'s
Vivaha Chakra removal) flagged this as explicitly deferred, not resolved.

Origin: Pancha Pakshi Shastra comes from Tamil Siddha literature —
sources agree it's "ancient Tamil Siddha" in origin and especially
associated with Tamil Nadu. By origin alone this is the same category of
import Vivaha Chakra was. The difference: independent evidence shows it's
been *naturalized* into Sinhala practice, not kept only as an unverified
stand-in —
- A dedicated Sinhala-language book, *Panchapakshi Shasthraya ha
  Yamakalaya* (පංචපක්ෂි ශාස්ත්‍රය හා යමකාලය) by O.A. Perera, sold through
  M.D. Gunasena — Sri Lanka's oldest publisher/bookseller (est. 1885).
  A dedicated title from a publisher of that stature is comparable in
  kind to the litha-product evidence that confirmed Rahu Kalaya's
  genuine Sri Lankan use in the round-2 audit.
- Sinhala-language astrology sites (kaladasava.com, a self-described
  Sri Lankan astrology portal; lankajhothisha.blogspot.com) present it
  as ordinary local practice, with no framing as a foreign import.
- The five birds carry naturalized Sinhala names (Bharunda/Raja Aliya,
  Bakamuna, Kaka, Kukkuta, Mayura), not bare transliterations — matching
  this app's existing `BirdId` enum (vulture/owl/crow/cock/peacock).

This doesn't reach Poya/ayanamsa's gazette-tier proof (no government or
almanac-committee source), but clears a meaningfully higher bar than "no
evidence" — the same tier as Rahu Kalaya, not the tier Vivaha Chakra or
Yamaganda/Gulika sit at. Verdict: keep the feature as-is; the roadmap
sourcing note now cites this evidence directly instead of carrying no
caveat at all.

### A1. Tara Bala — daily star-strength overlay
**One-line:** For a user's birth Nakshatra, classify today (and any date) as
Good/Not Good/Very Good/Bad/Totally Bad, per the classical 9-fold tārābala
cycle.

**Engine feasibility:** Directly computable today. `thaaraabalam(jd, place)`
(`vendor/jhora/panchanga/drik.py:3518`) takes today's Nakshatra (already
computed by `nakshatra()`, used throughout Panchanga/Pancha Pakshi) and
returns, for every possible birth star 1–27, which of the 9 tārā categories
(Janma, Sampatha, Vipatha, Kshema, Pratyaka, Sadhana, Naidhana, Mitra,
Paramitra) it falls into relative to today. The 9-category good/bad mapping
is hardcoded in the function itself, not invented.

**Wiring note:** Pancha Pakshi's Method A/B already compute or accept a
birth Nakshatra transiently, but saved profiles currently persist only the
derived bird + paksha (`apps/api/app/modules/pancha_pakshi/models.py`), not
the birth Nakshatra itself — so this needs the birth Nakshatra retained on
the profile, not just re-derivation from scratch.

**Cultural grounding:** Tārābala is a standard, widely-published classical
technique (not vendor-specific); the good/bad category list matches common
published tables. No gazette-style independent dataset exists to validate
against — same honesty caveat as most panchanga content that isn't a
Sri Lanka government-published date.

**Effort:** M (engine call is trivial; UI + profile plumbing for birth
Nakshatra persistence is the real work).

### A2. Chandrashtama alert
**One-line:** Flag when the Moon transits the 8th sign from a user's natal
Moon sign — the classical "avoid new ventures" window — with exact
start/end.

**Engine feasibility:** Directly computable. `chandrashtama(jd, place)`
(`drik.py:3597`) returns the chandrashtama rashi and the exact JD the Moon
next changes sign (via `next_planet_entry_date`). Needs the user's natal
Moon rashi, obtainable via `raasi(jd, place)` (`drik.py:765`) at birth time —
not currently surfaced anywhere in the app today.

**Correctness caveat:** Uses the app's validated Lahiri ayanamsa (see the
top-of-file note) — no longer gated, but a rashi boundary right at a
transition is still, inherently, a close call regardless of ayanamsa.

**Effort:** S–M.

### A3. Disha Shool — travel-direction caution
**One-line:** "Avoid traveling [direction] today" — a classical
weekday-based directional taboo, shown alongside Pancha Pakshi's existing
"best windows today" card.

**Engine feasibility:** Trivial and self-contained. `disha_shool(jd, place)`
(`drik.py:3750`) is a pure lookup: `const.disha_shool_map[vaara(jd,place)]`.
No birth data needed at all — works for any date/place, same input shape as
the existing Rahu/Yamaganda/Gulika kalams.

**Cultural grounding:** A standard, table-driven Vedic travel convention;
verifiable against any published disha shool weekday table as a sanity
check, though (like the kalams) not independently gazette-validated.

**Effort:** S.

---

## B. Deepening Daily Panchanga

### B1. Eclipse & Grahan calendar — more feasible than the repo's own docs suggest

**Status: shipped** — real contact times/magnitude only. A sutak-kaal
advisory window (proposed below) was built alongside it initially, then
removed: the later cultural-correctness audit (commit `4732cca`) found
it's a Hindu ritual-purity concept that Theravada Buddhism doctrinally
doesn't share, not something genuinely part of Sinhala practice.

**One-line:** "Next solar/lunar eclipse visible from [place]", with contact
times and magnitude.

**Engine feasibility:** Already fully computable with **zero re-vendoring**.
`next_solar_eclipse`/`next_lunar_eclipse`/`is_solar_eclipse`
(`drik.py:2707`–`2798`) call Swiss Ephemeris's own
`swe.sol_eclipse_when_loc` / lunar equivalent directly, using the exact
ephemeris files already shipped in the Docker image (`sepl_18.se1` /
`semo_18.se1`, per `apps/api/vendor/README.md`). This directly contradicts
`apps/api/vendor/FUTURE_DATA_USES.md`'s second table, which lists
`panchanga/{vratha,eclipse,...}.py` as *not currently vendored* and needed
for "eclipse predictions for the Panchanga module" — that upstream module
may add Vedic-specific refinements (sutak-kaal windows, grahan-parva
classification), but raw, location-aware eclipse timing and magnitude is
already sitting in the vendored tree, unused. Worth correcting that doc.

**Cultural grounding:** The astronomical contact times/magnitude are Swiss
Ephemeris ground truth (as precise as the loaded ephemeris file — no
approximation). A traditional "sutak kaal" advisory window (commonly ~12h
before a solar eclipse's contact, ~9h before a lunar one) is a well-known,
citable classical rule that layers cleanly on top of the real contact time,
but should be labeled as a named traditional convention, not presented as
computed astronomy.

**Effort:** M (engine work is nearly free; UI for a rare, irregularly-timed
event needs its own design, and "visible from Sri Lanka" filtering needs
care — `sol_eclipse_when_loc` is already location-aware, but partial/very
low-magnitude events need a sensible visibility cutoff).

### B2. Choghadiya + Hora auspicious-time layer

**Status: built, then removed.** All five were shipped and later cut in the
cultural-correctness audit (`4732cca`) — research found Gauri Choghadiya is
a North Indian/Gujarati system, Shubha Hora a South Indian/Tamil one, and
Amrit Kaalam/Abhijit Muhurta/Durmuhurtam had no Sinhala litha source either
— none genuinely part of Sinhala practice, just things the vendored engine
happened to support. Left below for historical record so this doesn't get
re-proposed without that context.

**One-line:** Add Gauri Choghadiya (North Indian 8-part day/night auspicious
segments), Shubha Hora (South Indian 12-part planetary hours), Amrit Kaalam,
Abhijit Muhurta, and Durmuhurtam alongside the existing Rahu/Yamaganda/Gulika
kalams.

**Engine feasibility:** Directly computable today, same pattern as the
kalams already shipped. `gauri_choghadiya`, `shubha_hora`, `amrit_kaalam`,
`abhijit_muhurta`, `durmuhurtam` (`drik.py:1376`–`1525`) are all pure
functions of `sunrise()`/`sunset()`/`vaara()` — the exact same primitives
`trikalam()` (already wired via `panchanga/adapter.py:65`) uses. No new data
files, no re-vendoring.

**Cultural grounding:** Table-driven, widely-published day-segment systems
(`const.gauri_choghadiya_day_table`, `const.shubha_hora_day_table`, etc. are
baked into the vendored `const.py`) — cross-checkable against any published
Choghadiya/Hora table the same way the kalams already are.

**Effort:** S–M (mechanically identical to the existing Kalams feature).

### B3. Today's Graha positions + retrograde/stationary flags
**One-line:** A "sky today" panel — sidereal longitude and rashi for all 9
grahas, flagging any that are retrograde or stationary.

**Engine feasibility:** Directly computable. `planetary_positions(jd, place)`
(`drik.py:1529`) returns full planet positions; `planets_in_retrograde`
(`drik.py:331`) and `planets_in_stationary` (`drik.py:358`) are pure
`swe.calc_ut` speed-sign checks, no extra data needed.

**Correctness note:** Same as A2 — uses the app's validated Lahiri ayanamsa,
no longer gated.

**Effort:** S–M.

### B4. Moon Rashi of the day
**One-line:** Surface "Moon is in [Rashi] until [time]" directly — the same
treatment Nakshatra already gets.

**Engine feasibility:** Trivial — `raasi(jd, place)` (`drik.py:765`) is
already computed internally elsewhere in the engine but never exposed by
`panchanga/adapter.py` today. Same call shape as the existing `nakshatra()`
wiring.

**Effort:** S.

### B5. Ritu (season) and Samvatsara (60-year cycle name) badges
**One-line:** Add the Vedic season name and the 60-year Jupiter-cycle year
name (Prabhava…Akshaya) to the panchanga response.

**Engine feasibility:** `ritu(maasa_index)` (`drik.py:1369`) is pure
arithmetic on the lunar month index already computed
(`(maasa_index-1)//2`). `samvatsara(panchanga_date, place)` (`drik.py:1349`)
is also computable today.

**Correctness caveat — take this seriously:** `samvatsara()`'s own
docstring flags unresolved uncertainty: *"TODO: Chithirai always shows
previous year… Is there an algorithm for lunar samvatsara?"* This is the
vendored engine itself admitting an open question, not settled astronomy.
Ritu is safe to ship as-is; Samvatsara should either be held back until that
TODO is understood, or shipped with an explicit caveat rather than presented
as authoritative — exactly the "don't gloss over it" standard the Poya
divergence note already sets.

**Effort:** S (Ritu), S but gated on a decision (Samvatsara).

---

## C. Deepening Bird Compatibility

### C1. Vivaha Chakra Palan — wedding-date screener

**Status: built, then removed.** Shipped, then cut once Porondam (see
Section E2's update below) shipped as the actual Sri Lankan wedding-
matching standard — Vivaha Chakra Palan is a Tamil/pan-Indian method that
was only ever a stand-in for that gap, and this section's own cultural-
grounding note (no independent dataset to validate the outcome table
against) never stopped applying. Left below for historical record.

**One-line:** For a candidate wedding date/place, return a 1–9 categorical
verdict on the day's own Sun–Moon nakshatra relationship (e.g. "Wonderful
pair and blessed" vs. "Devastating results for the girl") — a
muhurta-quality check for the date itself, distinct from and complementary
to Bird Compatibility's two-person bird lookup.

**Engine feasibility:** Directly computable. `vivaha_chakra_palan(jd, place)`
(`drik.py:3399`) computes the date's Sun and Moon nakshatra-pada, places
them on a 3×3 "marriage wheel" grid, and returns one of 9 fixed outcome
categories (the outcome text is hardcoded in the function's own docstring —
transcribed from the pinned commit, same handling `birth-bird.md` already
applies to the bird-mapping table).

**Cultural grounding:** The outcome categories are baked into the vendored
source itself (traceable to the exact pinned commit), but — unlike the Poya
day rule — no independent published dataset was found during this research
to cross-validate the 9-category outcome table against. Ship it labeled as
"per this engine's Vivaha Chakra method," not as an unqualified universal
truth, and don't claim gazette-style validation for it.

**Effort:** M (new small module or Compatibility sub-feature; the maths is
one function call).

*(Ashtakoot/Guna-Milan-style two-person nakshatra matching was also
investigated for this category — see Section E: it's not recommended as
things stand.)*

---

## D. Genuinely new modules (currently-unused vendored capability)

### D1. Divisional charts (Varga) explorer, built on birth details already collected
**Status: both the D9 Navamsa view and the base D1 Rasi (birth chart)
have shipped.** D1 needed zero new vendored-engine integration — it's
`divisional_chart_factor=1` on the exact same `dhasavarga`/`ascendant`
calls D9 already exercises, confirmed by a cross-module test tying the
two together. The North Indian diamond rendering built for D9 (house-
fixed cells, rashi rotating with the Ascendant) was extracted into a
shared `RasiStyleChart` component and reused directly for D1, adding
house-number labels and per-planet/Ascendant degrees-within-sign (a
birth chart is read "by house" and by exact degree far more than a
divisional chart is; Navamsa deliberately stays sign-only). Higher
vargas (D10 Dasamsa, etc.) remain unbuilt.

**One-line:** A Navamsa (D9) chart view, and more generally any of the D1–D60
divisional charts, computed from the same birth date/time/place already
captured by Pancha Pakshi's Method A.

**Engine feasibility:** The full varga system is already vendored and
working, just unused by the app. `dhasavarga(jd, place,
divisional_chart_factor=N)` (`drik.py:1806`) and `dasavarga_from_long`
(`drik.py:1740`) implement all of Hora(2), Drekkana(3), Chaturthamsa(4)...
Navamsa(9), Dasamsa(10), ... up to Shastyamsa(60), per the function's own
documented `divisional_chart_factor` table. This is the mathematical core of
a birth-chart/Kundali module, sitting fully implemented and unused.

**Correctness caveat:** No longer gated — the app now explicitly runs
validated Lahiri (see top-of-file note), the same convention most other
software/pandits compare against. A birth chart is still the highest-stakes
place to get the sidereal zero-point right, since users will screenshot and
compare it directly.

**Effort:** L (engine math is free; needs real chart-rendering UI, planet/
rashi iconography from `packages/design-system`, and a decision on which
vargas to expose first — D9 Navamsa is the highest-value single addition).

### D2. Fixed-star precision — shipped as the birth chart's yogatara layer

**Status: shipped (2026-07-20).** This section's original gate — "don't
build without a specific, named classical use" — was satisfied and the
feature shipped as a birth-chart extension, not a generic star finder.

The named classical use found: **yogatara (junction stars)** — the
principal star classical astronomy identifies each nakshatra with,
tabulated in Surya Siddhanta ch. 8 ("On the Conjunction of Planets with
the Stars", Burgess translation) and operationalized for the modern sky by
the **Report of the Calendar Reform Committee (1955), Table 5 "Stars of
the Naksatra divisions"** — the same document whose Chitra = Spica anchor
defines this app's Lahiri ayanamsa. That lineage identity is what makes
the source pinnable to this project's standard: one authoritative
27-entry table, from the authority the app already rests on.

What shipped: `POST /api/v1/birth-chart/rasi` now returns `yogataras`
(all 27 star positions, placed like grahas) and `graha_yogataras` (each
graha's nakshatra + angular separation to its junction star); the birth
chart page renders a toggleable star overlay on the diamond chart plus a
per-graha table with a sourcing note. Mapping table + identification
notes: `apps/api/app/modules/birth_chart/yogatara.py`; identity goldens:
`tests/test_yogatara.py` (CRC's printed ecliptic latitudes, being nearly
epoch-independent, discriminate star identity per search key).

Documented divergences, resolved Chitra-vedha-style (pin + footnote):
Ashlesha (CRC alpha Cancri vs. modern epsilon Hydrae lists — the vendored
sefstars.txt's own "Ashlesha (Colebrook)" alias agrees with CRC);
Vishakha (CRC alpha Librae — the bright alpha-2, latitude-verified — vs.
sefstars.txt's own "Vishakha" alias pointing at iota-1 Librae, which was
deliberately NOT used); Shatabhisha (CRC lambda Aquarii vs. Wikipedia's
gamma Aquarii). CRC itself notes seven yogataras fall outside their own
13°20' division — inherited honestly, shown as-is, stated in the UI note.

Two infrastructure facts this build surfaced: (1) `sefstars.txt` now
ships in the Docker image (curated cp list + MANIFEST.image.sha256
regenerated — it was repo-only before); (2) pyswisseph keeps *per-thread*
state — the ephemeris path set at import didn't exist in Starlette
threadpool workers, which made `swe.fixstar_ut` hard-fail there and
retroactively explains the documented cross-thread arcsecond drift
(planetary calc_ut degrades silently to Moshier without the files).
`configure_ayanamsa` now re-sets the ephe path per call alongside the
ayanamsa — see its docstring in `app/core/vendor_path.py`.

### D2b. Asteroid overlays — ruled out (research verdict, 2026-07-20)

The roadmap's former "asteroid + fixed-star overlays" pairing was
half-infeasible: the retained asteroid files (`seasnam.txt`,
`ast_list.txt`, `seorbel.txt`) are name/orbital-element *text* files
only — the binary `seas_*.se1` position ephemeris was never vendored and
is absent from the repo entirely, and the engine has zero asteroid
constants or live code paths (`dhasavarga`'s `include_western_planets`
parameter is dead code in V4.8.7, and it only ever covered
Uranus–Pluto anyway). Building asteroid positions would mean a fresh
upstream re-vendor plus net-new computation code — for a feature class
(Ceres/Chiron overlays) that is Western practice, the same category
rounds 1–3 removed features for. Verdict: not built, not scheduled;
`FUTURE_DATA_USES.md`'s asteroid rows now carry the correction.

---

## E. Explicitly not recommended

### E1. Vimshottari/other Dasha calculators

**Status: shipped, with Antardasha depth.** This verdict was written
when the dasha computation module wasn't vendored at all. Resolved in
three steps: (1) commit `1fe849e` vendored the Vimshottari subset of
`jhora/horoscope/` (9 files — `chart/{house,sphuta,charts}.py`,
`dhasa/graha/{vimsottari,shastihayani}.py`, plus package `__init__.py`s),
checksummed and golden-tested — `apps/api/tests/test_vendor_dasha_engine.py`
reproduces an upstream textbook worked example exactly under this app's
own pinned LAHIRI ayanamsa; (2) the application module
(`app/modules/dasha/`, `POST /api/v1/dasha/mahadasha`, `/dasha` page,
feature-registry entry, locale strings) shipped Mahadasha-only as v1;
(3) Antardasha/Bhukti nesting followed as the documented v2 fast-follow
— each of the 9 Mahadashas now carries its 9 sub-periods (derived from
a single ANTARA-depth engine call), rendered as an expandable accordion
with the current period highlighted at both levels.

**Deeper levels (Pratyantara, Sookshma, Prana, Deha — engine depths
3–6) are supported by the vendored engine but not exposed**, and are
not scheduled — no commitment until a concrete use case turns up.

**Cultural grounding (round-4 audit, 2026-07-19):** Vimshottari Dasha
clears the same naturalized-SL-practice bar Pancha Pakshi did in A0,
and by a wider margin —
- A Sri Lankan astrology source states directly that the Vimshottari
  system is the maha-dasha method predominantly used in Sri Lanka
  ("විංශෝත්තරී දශා ක්‍රමය ශ්‍රී ලංකාව ඉන්දියාව ආදී පෙරදිග රටවල වැඩි
  වශයෙන් භාවිතා..."), citing the Parashara 120-year framework.
- Mainstream Sinhala press astrology columns treat it as ordinary
  practice: Lankadeepa ("රාහු මහ දශාවේ සහ අන්තර් දශාවල පලාපල") and
  Divaina's nakatha section ("පලාඵල කථනයට මහෝපකාරී දශා ක්‍රම").
- kaladasava.com (the same SL portal cited in A0) carries a dedicated
  "විංශෝත්තරී මහා දශා හා අතුරු දශා පල විපාක" reference page.

The same audit found and fixed a terminology defect in the shipped
Sinhala strings: the transliteration "විම්ශෝත්තරී" was nonstandard —
every SL source writes **විංශෝත්තරී** (with binduva) — and the
unspaced "මහාදශා"/"අන්තර්දශා" compounds were replaced with the forms
those sources actually use: **මහා දශා**, and **අතුරු දශා** for the
sub-periods (the native Sinhala term used consistently by kaladasava
and lankajhothisha; "අන්තර් දශා" is also attested, e.g. Lankadeepa,
but අතුරු දශා is the practice-literature norm). English "Vimshottari
/ Mahadasha / Antardasha" strings were already standard and unchanged.

The original caution below remains valid for whoever builds that module
and is worth keeping: do not attempt to reimplement dasha period math
from `const.py`'s standalone constants (`vimsottari_adhipati_list`,
`human_life_span_for_vimsottari_dhasa`, etc.) instead of calling the
now-vendored real module — that's exactly the "inventing tradition
without vendored ground truth" this project's honesty bar exists to
prevent. The real module is vendored and golden-tested now, so this
caution should never actually bite in practice, but it explains why the
constants were deliberately left unused for 3+ shipped modules until the
real computation module was vendored.

Other named dasha systems (Ashtottari, Yogini, Kalachakra, Narayana,
Chara, ~25 more upstream) remain unvendored and out of scope until
individually justified — this vendoring pass only pulled in the
Vimshottari-specific closure, not the rest of `horoscope/dhasa/`.

### E2. Ashtakoot / Guna-Milan two-person marriage-score matching

**Status: partially superseded by Porondam.** This verdict was reached
without knowing that Sri Lanka's actual wedding-matching standard
("Porondam"/"Visi Porondama") overlaps almost exactly with the classical
Ashtakoot / Tamil Thirumana Porutham core 10 categories — a later research
round found real, widely-published compatibility tables for 7 of them
(Nakshatra, Gana, Yoni, Rashi, Rashyadpathi, Vashya, Vedha), transcribed
by hand into `apps/api/app/modules/porondam/repository.py` rather than
vendored (the vendored engine still has no matching function — that part
of this verdict still holds). Vedha's table needed a deliberate resolution
of one disputed nakshatra (Chitra — see `repository.py`), not a recall
guess. Rajju was specifically checked against 4 independent sources and
found to have real, substantive disagreement on nakshatra groupings (not
a formatting quirk) — still deferred. Mahendra and Sthree-Dheerga were
then researched too, and found blocked the same way: Mahendra's counting
rule (bride's star to groom's star, match at position 4/7/10/13/16/19/
22/25) is stated consistently across every source checked, but none
supplies a reproducible worked example — a named nakshatra pair with a
stated pass/fail — needed to confirm inclusive/exclusive counting and
direction; Sthree-Dheerga's sources actively disagree on the threshold
itself (variously "exceeds 15", "13", or "7" depending on source). All
three remaining core categories (Rajju, Mahendra, Sthree-Dheerga) now
share one blocker — no pinnable source with a worked example — so
Porondam is paused at 7/10 core categories until one turns up.

Real two-person nakshatra-matching (Gana, Tara, Yoni, Rasi, Rajju koota
scoring) is a natural extension of Bird Compatibility, and `const.py` even
carries the scoring thresholds (`compatibility_minimum_score_north/south`,
`mandatory_compatibility_south_list`, `const.py:701`–`705`). But a grep of
the entire vendored tree turns up **no computation function anywhere** —
only these threshold constants, no matching algorithm. Building a fake
"compatibility score out of 36" using just the category names, without the
real scoring rules, would be inventing methodology and presenting it as
authoritative — the opposite of the Poya gazette-validation standard this
platform holds itself to. Don't build this until the real matching module is
vendored.

### E3. Avurudu Nekath (Sinhala/Tamil New Year auspicious times)
Already correctly ruled out in `docs/calculations/panchanga.md` and
`docs/roadmap.md`: these are published annually as astrologer-panel PDFs
with no structured, computable dataset, and no calculation can be validated
against them. This research reaffirms that decision — nothing found in the
vendored engine changes it.

### E3b. Festival calendar — shipped Poya-only; Hindu-festival path researched and deliberately not built

A dedicated feasibility pass (2026-07-18) split the "festival calendar"
backlog item into three categories:

1. **Poya-derived Buddhist festivals — shipped.** All 12 (Vesak, Poson,
   Esala, Duruthu, …) are exactly the full moons of the Sinhala months the
   gazette-validated Poya layer already computes; the festival identity IS
   `sinhala_month.key`. Shipped as a frontend-only significance layer
   (`enums.poyaSignificance` in both locale files, surfaced on the Daily
   Panchanga Poya badge and the shared `PoyaDetailCard` used by the moon
   calendar and daily guide). Zero new calculation, vendoring, or API
   change — a backend `festival_key` field would have literally duplicated
   `poya.month_key`. **Round-4 audit (2026-07-19): all 12 significance
   attributions verified against ≥2 independent sources** (Colombo
   Dhamma Friends' full Poya-days reference, Kariyawasam's *Buddhist
   Ceremonies and Rituals of Sri Lanka* (BPS Wheel 402), Daily Mirror /
   News First feature articles, official SL consulate pages) — no
   corrections needed. Two honesty footnotes from that pass: (a) Vap
   and Il each carry several traditional attributions (Vap: also the
   Buddha's return from Tavatimsa, and CDF leads with the meeting with
   Maitri Bodhisatta; Il: also Maitreya's vivarana) — the shipped
   strings use the most widely attested SL framing (end of Vas /
   Kathina season; despatch of the first sixty), which is a selection
   among valid attributions, not the only one; (b) Kariyawasam places
   the Nagadipa visit on the Bak *new*-moon rather than the full moon —
   mainstream SL sources (CDF, lakpura, press) attribute it to Bak
   Poya, which the shipped string follows.
2. **Hindu festivals from panchanga elements — feasible but deliberately
   not built.** Upstream `jhora/panchanga/vratha.py` (unvendored) has a
   CSV-driven festival matcher (`get_festivals_between_the_dates`,
   `sankranti_dates`, etc.) whose dependency closure is already fully
   vendored; only `vratha.py` itself plus
   `data/hindu_festivals_multilingual_unicode_bom.csv` (355 rows) would
   need re-vendoring. Not built because: the dataset is pan-Indian/Tamil
   framed with **no Sinhala labels**, upstream has **zero test fixtures**
   for the festival matcher (validation would be built from scratch), and
   the culturally-central Sri Lankan set is already covered by (1). If a
   curated SL Hindu-holiday subset (Thai Pongal, Deepavali, Maha
   Shivaratri — all public holidays) is ever prioritized, that's the
   documented path: re-vendor those two files, filter to the curated
   subset, author Sinhala labels, and build own validation fixtures.
   `FUTURE_DATA_USES.md`'s vratha re-vendor note remains accurate.
3. **Astrologer-panel-published dates — ruled out**, unchanged (E3 above).

### E4. Generic "Horoscope of the Day" / predictive text
No specific finding drives this — it's a category call. Any feature that
generates personalized predictive or advice text not tied to a specific,
named, citable classical rule (like Tara Bala's fixed 9-category table, or
Porondam's per-category classification tables) would be fabricated content
riding on top of real computation, which is precisely the pattern this
platform's methodology pages exist to avoid. If a future idea in this space
comes up, it needs the same treatment as everything above: cite the rule,
cite the source, and say plainly when there isn't one.

### E5. ~~Shipping any new sidereal/rashi-dependent feature without resolving the ayanamsa discrepancy~~ — resolved
Was a gating item; no longer is. The engine explicitly runs Lahiri now,
validated against the officially published Sri Lankan New Year instant
across three years (see the top-of-file note and
`docs/calculations/panchanga.md`). A2, B3, B4, and D1 can proceed against
that as a settled default.

---

## Summary table

| # | Idea | Category | Engine-ready today? | Effort |
|---|---|---|---|---|
| A1 | Tara Bala daily overlay | Deepen Pancha Pakshi | Yes (`thaaraabalam`) | M |
| A2 | Chandrashtama alert | Deepen Pancha Pakshi | Yes (`chandrashtama`, `raasi`) | S–M |
| A3 | Disha Shool travel caution | Deepen Pancha Pakshi | Yes (`disha_shool`) | S |
| B1 | Eclipse & Grahan calendar (shipped, no sutak-kaal) | Deepen Panchanga | Yes, already vendored | M |
| B2 | Choghadiya + Hora layer (built, then removed — not Sinhala) | Deepen Panchanga | Yes | S–M |
| B3 | Graha positions + retrograde | Deepen Panchanga | Yes | S–M |
| B4 | Moon Rashi of the day | Deepen Panchanga | Yes (`raasi`) | S |
| B5 | Ritu / Samvatsara badges | Deepen Panchanga | Ritu yes; Samvatsara caveated | S |
| C1 | Vivaha Chakra Palan (built, then removed — superseded by Porondam) | Deepen Compatibility | Yes | M |
| D1 | Divisional charts (Navamsa + D1 Rasi birth chart) (shipped) | New module | Yes | L |
| D2 | Fixed-star precision (shipped as birth-chart yogatara layer) | Shipped | Yes — CRC 1955 Table 5 pinned; sefstars.txt now in image | M |
| D2b | Asteroid overlays | Ruled out | No — seas_*.se1 never vendored; zero engine support; Western practice | — |
| D3 | Porondam — Sri Lankan wedding matching (shipped, 7/10 core) | New module | Yes, hand-transcribed classical tables | L |
| E1 | Dasha calculators (shipped, Mahadasha + Antardasha) | New module | Yes — Vimshottari subset golden-tested | M |
| E2 | Ashtakoot marriage score (partially superseded by Porondam) | Not recommended | No — constants only, no algorithm | — |
| E3 | Avurudu Nekath | Not recommended | No — no computable dataset | — |
| E3b | Festival calendar (shipped, Poya-only significance layer) | Shipped | Yes — rides the gazette-validated Poya layer | S |
| E4 | Generic horoscope text | Not recommended | N/A — no rule to cite | — |

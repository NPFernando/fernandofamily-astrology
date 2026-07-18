# Daily Panchanga

## Elements

`POST /api/v1/panchanga/daily` returns the five traditional panchanga
elements (tithi, nakshatra, yoga, karana, vaara/weekday) for a location and
date, plus the three inauspicious kalams (rahu, yamaganda, gulika) and
sun/moon rise-set times. Every element is computed directly from the
vendored, pinned engine (see [`birth-bird.md`](birth-bird.md) for the
general adapter/calculator layering this module reuses) — none of it is
looked up from a static table.

Elements that change more than once within a single calendar day (tithi,
nakshatra, yoga can each end and hand off to the next element before the
following sunrise) return every entry that overlaps the day, each with its
own end time, rather than only the value in effect at sunrise.

**Kalam sourcing — an asymmetry worth being explicit about.** All three
kalams are computed identically (via the vendored engine's `trikalam()`,
under its Tamil-derived option strings `"raahu kaalam"`/`"yamagandam"`/
`"gulikai"`), but they don't have equal independent evidence of Sri
Lankan-specific use. **Rahu Kalaya** is well-supported: it's the
headline daily item on multiple dedicated Sri Lankan (`.lk`) sites and
litha products, shown in Sinhala (රාහු කාලය), computed for Sri Lankan
locations, and appears unprompted in general Sri Lankan astrology
overviews. **Yamaganda and Gulika Kalaya**, by contrast, could not be
found with the same independent confirmation during this review — they
appear bundled with Rahu Kalaya on generic (mostly Indian) astrology
sites, but a search restricted to Sri Lankan sources, and a direct
check of a 2026 Sri Lankan litha product page, surfaced Rahu Kalaya
specifically while omitting Yamaganda/Gulika from the described daily
contents. This doesn't mean they're wrong for Sri Lanka — they're
standard panchanga elements a fuller litha may still include — but
unlike Poya (73/73 gazetted dates) or ayanamsa (State Astrologers'
Committee cross-check) below, this is not independently gazette- or
litha-validated the way this project's stronger claims are, and should
be read as a standard convention rather than a confirmed Sri Lankan-
specific one.

## Ayanamsa

Sidereal longitudes — which every element above ultimately derives from —
depend on the ayanamsa (the offset between the tropical and sidereal
zodiacs). This app explicitly configures **Lahiri** (`app/core/vendor_path.py`,
`configure_ayanamsa`/`ensure_ayanamsa`), the same mode Pancha Pakshi's
schedule calculations use.

This wasn't always true, and wasn't always deliberate. Two earlier claims
about this engine's ayanamsa both turned out to be wrong: the vendored
engine's own `const.py` states a default of `TRUE_PUSHYA`, but that default
is only ever applied inside a `drik.py` block guarded by
`if __name__ == "__main__":` — dead code from this app's point of view. This
doc previously claimed "a Lahiri-family ayanamsa" as the vendored engine's
"own default." Neither was actually running: nothing in this app ever called
swisseph's `set_sid_mode`, so it silently fell back to swisseph's
compiled-in default, Fagan-Bradley — for every request, in every prior
release.

**Why Lahiri, and how it was checked.** Sri Lanka's Sinhala/Tamil New Year
("Aluth Avurudu") officially dawns at the exact instant the Sun's sidereal
longitude crosses 0 degrees (Mesha Sankranti) — a single moment, published
annually by the State Astrologers' Committee and reported by national news
outlets, that a large share of the country sets its New Year rituals by.
Unlike tithi (a Moon-minus-Sun difference, so the ayanamsa offset cancels
out and can't distinguish candidate modes — this is why the Poya fixture
below can't answer this question), the New Year instant is a raw absolute
solar longitude and is exactly as ayanamsa-sensitive as it gets. Computing
that instant under Lahiri matches the officially published dawn time to
within about a minute in each of 2024, 2025, and 2026; Fagan-Bradley (the
engine's undocumented actual prior behavior) misses by roughly a full day;
every other candidate mode checked misses by tens of minutes to hours. See
`apps/api/scripts/dev/ayanamsa_newyear_check.py` for the full derivation and
cross-check table, and `apps/api/tests/test_ayanamsa.py` for the regression
guard.

This settles the astronomical/computational question — which single global
ayanamsa offset this engine should use — against a real, independently
verifiable, Sri Lankan public source. It is not the same as full expert or
community review of every downstream element (nakshatra/yoga boundary
placements, Pancha Pakshi birth-bird assignments right at a boundary); those
remain open for anyone with deeper traditional-astrology expertise to weigh
in on.

Different published Sri Lankan litha can still use slightly different
ayanamsa conventions or rounding; where they diverge from Lahiri, an
element's end time can differ by a few minutes from what a particular
printed almanac shows. That remaining gap is a genuine cross-tradition
difference, not a bug in either source.

## Sri Lankan layer: Poya days and Sinhala months

In addition to the pan-Vedic elements above, the response includes:

- `sinhala_month` — the Poya-cycle month name (bak, vesak, poson, esala,
  nikini, binara, vap, il, unduvap, duruthu, nawam, madin; an `adhi-` prefix
  marks a leap/intercalary month), which is what a Sri Lankan reader expects
  to see rather than the Sanskrit amanta month name (`lunar_month`, still
  returned alongside it). The Sinhala month for a date is the month named
  for that date's *next* Poya.
- `is_poya_day` / `poya` — whether the date is a full-moon Poya day, and if
  so, which one.
- `next_poya` — the date and month of the next (or, on a Poya day itself,
  that same) Poya.

**Poya-day rule.** A civil date is a Poya day when a purnima (full-moon
tithi) begins on that date at least 15 minutes before that date's sunset;
otherwise the Poya falls on the following date. This rule, and the Sinhala
month naming built on it, were derived empirically — not assumed — by
computing every candidate rule against all 73 officially gazetted Sri
Lankan Poya days from 2021 through 2026 (source: the
[Dilshan-H/srilanka-holidays](https://github.com/Dilshan-H/srilanka-holidays)
dataset, MIT-licensed, committed as a verification fixture at
`apps/api/tests/fixtures/sl_poya_2021_2026.json`; the comparison script is
`apps/api/scripts/dev/poya_rule_discovery.py`). The chosen rule reproduces
**100% (73/73)** of the gazetted dates, including 2026's intercalary
"Adhi Esala" Poya.

**Known divergences.** Sinhala month naming matches the gazette for 71 of
those 73 dates. Both exceptions come from the same mechanism: which lunar
cycle in a ~32.5-month period gets flagged as the intercalary (adhika) month
is a razor's-edge classification — whichever cycle contains no sankranti is
adhika, and a sankranti's exact moment is exactly as ayanamsa-sensitive as
the New Year validation above.

- **2023**: the gazette names its intercalary month "Adhi Esala"; under the
  validated Lahiri ayanamsa this engine places it one cycle later, computing
  "Adhi Nikini" instead (with the following month, "Esala", not "Adhi
  Esala"). Confirming Lahiri moved this boundary from where it sat under the
  engine's prior (accidental) Fagan-Bradley default — see
  `apps/api/scripts/dev/ayanamsa_newyear_check.py`.
- **2026-05-30**: the gazette names it "Vesak Full Moon Poya Day", while this
  engine computes "Adhi Poson". This divergence predates the Lahiri fix and
  is unaffected by it — that boundary isn't close enough for an
  ayanamsa-sized shift to move it.

Neither is a computation error — both are convention differences in
adhika-month placement between this engine and that year's gazette panel,
encoded as named, tested exceptions in `apps/api/tests/test_poya.py` rather
than silently forced to match.

**Coverage range.** Poya and Sinhala-month computation share the same
ephemeris-driven date range as the rest of the engine — see the image's
trimmed range in [`../../apps/api/vendor/README.md`](../../apps/api/vendor/README.md).

**Not implemented.** The full Avurudu Nekath Seettuwa (the New Year's other
astrologer-panel auspicious times — meal preparation, commencing work, oil
anointing, etc.) are published annually as PDFs by a government-convened
panel and are not derivable by calculation the way the New Year's own dawn
instant is — there is no computable methodology behind those specific
times, only the panel's own published schedule. This app does not expose
them as a feature; they're used above only as an ayanamsa validation source
(the dawn instant itself, not the rest of the schedule, is a pure
astronomical calculation). Adding the full nekath schedule as a feature
would require transcribing each year's published PDF by hand; see
[`../roadmap.md`](../roadmap.md).

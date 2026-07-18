"""Porondam (Sri Lankan wedding horoscope matching) module.

Ships 7 of the traditional 10-12 core Porondama (Nakshatra/Tara, Gana,
Yoni, Rashi, Rashyadpathi, Vashya, Vedha) — the categories with standard,
cross-tradition-documented (Ashtakoot / Tamil Thirumana Porutham)
compatibility tables. Vedha's table has one documented edge case (see
repository.py's VEDHA_PAIRS comment) resolved deliberately, not by recall.
Rajju was researched and found to have real, substantive disagreement
across independent sources (not just formatting) on which nakshatras fall
in which of the 5 body-part groups — deferred pending a single pinned
reference, not built from conflicting recall. Mahendra and Sthree-Dheerga
were also researched and found blocked the same way: Mahendra's counting
rule (position 4/7/10/13/16/19/22/25 from the bride's star) is consistent
across every source checked, but none supplies an actual worked example
(a named nakshatra pair with a stated pass/fail) to confirm inclusive/
exclusive counting or direction; Sthree-Dheerga's sources outright
disagree on the threshold itself (claims of "exceeds 15", "13", and "7"
all found). Porondam is paused at 7/10 until a pinnable source turns up
for any of these three. The extended ~10 (Linga, Gothra, Varna, Vruksha,
Ayusha, Bhootha, Pakshi, Nadi, Dina, Graha) are deliberately not built
yet either — each needs a specific, pinned reference before
implementation, the same bar every feature this session has been held to
(see docs — this is a partial screen, not a complete traditional
matching, and the UI says so plainly).
"""

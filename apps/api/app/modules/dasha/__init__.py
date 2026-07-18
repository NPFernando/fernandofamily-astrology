"""Dasha (Vimshottari planetary period timeline) module.

v1 ships Mahadasha only -- the 9 major periods spanning the full ~120-year
Vimshottari cycle from birth. Antardasha/Bhukti sub-period nesting is
deliberately deferred (the engine already supports it, golden-tested at
ANTARA depth in tests/test_vendor_dasha_engine.py) -- same "ship the base
feature, add depth as an explicit fast-follow" pattern as Birth Chart's
sign-only-then-degrees rollout.
"""

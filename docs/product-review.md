# Product review — current frontend baseline

This review records the next product decisions from the current bilingual,
mobile-first site rather than adding speculative features to navigation.

## What is working well

- The landing page groups tools by intent, uses generated posters only when
  appropriate for the connection, and has a persistent low-data preference.
- Birth tools now reuse device-local inputs and same-tab calculated identity,
  chart and Dasha results. No birth input is put into a URL or server store.
- The compact Display Preferences panel is keyboard-operable, Escape closes it
  predictably, and its mobile layouts have visual regression coverage.

## Prioritized next product experiments

1. Add an explicit “Use current calculation” indicator on compatible reports,
   followed by a one-click “Start fresh” action. Validate with people who use
   shared devices before changing persistence policy.
2. Test whether the grouped landing sections help first-time visitors find
   Birth Nakshatra and Daily Guide faster than a flat tool grid.
3. Keep result sharing same-tab only unless users explicitly choose a saved,
   derived profile. Never silently sync raw birth inputs to an account.
4. Review Sinhala line lengths and labels on physical 360px devices before
   changing the mobile navigation density again.

## Release criteria retained

Every change must keep the privacy/secret scan, browser accessibility checks,
visual baselines, standalone smoke test, and Lighthouse/initial-JavaScript
budgets green.

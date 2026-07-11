# Timezone handling

## IANA timezones only, never inferred from coordinates

Every calculation requires an explicit IANA timezone name (e.g.
`Asia/Colombo`), validated against Python's `zoneinfo.available_timezones()`.
Longitude alone is never used to infer a timezone or UTC offset — two
places at similar longitude can be in very different timezones (political
boundaries, DST rules), so this would silently produce wrong local times.

## DST-correct by construction

The UTC offset used for a calculation is resolved for the *effective*
sunrise-based date (see [`schedule.md`](schedule.md)'s rollback rule), not
the originally requested calendar date. This distinction matters exactly at
DST transitions: a request made just after local midnight on a
spring-forward day, whose target time falls before that day's sunrise, rolls
back to the previous (pre-transition) day — and must use the pre-transition
UTC offset, not the offset that becomes active later that same civil day.
Resolving the offset before checking the rollback, instead of after, would
silently apply the wrong offset in exactly this window. This is covered by
an explicit regression test using a real DST-transition date.

## All returned timestamps

- Are valid ISO 8601, with an explicit UTC offset (e.g. `+05:30`), not just
  a bare local time.
- Separately identify the IANA timezone name used, so a client that wants to
  re-render in a different display format still knows the source timezone
  unambiguously.
- Are computed to handle midnight crossing (a sunrise-to-sunrise schedule
  routinely spans a civil-calendar midnight) and DST transitions within the
  same schedule (a sub-period could in principle start before a transition
  and end after it, in timezones/dates where that's possible) without
  producing an inconsistent or wall-clock-ambiguous result.

## Locations where sunrise/sunset can't be reliably calculated

At extreme latitudes during polar day/night, sunrise or sunset may not occur
within the relevant window at all. Rather than silently approximating a
result in this case, the calculation raises a controlled, typed error
(`sunrise_unavailable`), which the API surfaces as a `422` with a clear
error code — never a generic `500`, and never a plausible-looking but
silently wrong schedule.

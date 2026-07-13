# Privacy

## Accounts are optional; birth data never lives on the server

This app doesn't require an account. Everything works anonymously, with all
data kept on your device. Each calculation request is processed and its
result returned; nothing about the request itself is retained afterward.

An **invite-only Google sign-in** exists for syncing saved profiles and
preferences across devices. When signed in, the server stores only: a label
you chose, plus the derived bird — or nakshatra and paksha. **Raw birth
date, time, and coordinates are never stored server-side, signed in or
not** (they're not even sent to the account endpoints). Who may sign in is
controlled by an explicit server-side allowlist.

Birth data and precise coordinates are never:

- Placed in a URL, query string, or path parameter.
- Written to application logs, even at debug level.
- Sent to any analytics or error-monitoring service.
- Used as, or embedded in, a cache key that's visible outside the server.

## What's stored in your browser (and only there)

- Your language and theme preference.
- Your selected/direct bird choice, if you use that input method.
- A short list of recently used locations (name, latitude, longitude,
  timezone — never birth date/time).
- The most recently successfully calculated schedule, so it can be shown
  (clearly labeled as cached, with its original generation time) if you open
  the app while offline.

All of the above lives only in your browser's local storage. A "clear saved
preferences" action on the Privacy page removes all of it.

## Location

If you use "Use my location," your device's coordinates are read by your
browser after you explicitly grant permission, and are resolved to a
timezone entirely on your device (no third-party lookup of your exact
location). If you search for a place by name instead, that search is sent
to a third-party geocoding service (Open-Meteo) to resolve it to
coordinates — only the place name you typed is sent, not any location your
device has provided.

## Third parties

No advertising, no tracking pixels, no analytics that would let a third
party build a profile from your usage of this tool.

## Period alerts (web push)

If you enable period alerts, the server stores — per subscribed browser —
the push endpoint and its delivery keys, your bird (or nakshatra + paksha),
a location **rounded to ~1 km before storage** (2 decimal places; the
columns cannot hold more precision), your chosen alert lead time and effect
level, and your language. Never your birth date, time, or exact coordinates.

Disabling alerts (or the push service reporting the subscription gone)
deletes the stored subscription immediately; the send-log rows that prevent
duplicate alerts are pruned within two days.

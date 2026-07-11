# Privacy

## No accounts, no server-side storage of birth data

This app doesn't require an account, and doesn't store birth details (date,
time, or precise location) anywhere on the server. Each calculation request
is processed and its result returned; nothing about the request itself is
retained afterward.

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

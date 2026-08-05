# Privacy

## Accounts are optional; birth data never lives on the server

This app doesn't require an account. Everything works anonymously, with all
data kept on your device. Each calculation request is processed and its
result returned; nothing about the request itself is retained afterward.

An **invite-only Google sign-in** exists for syncing saved profiles and
preferences across devices. When signed in, saved profiles store only: a
label you chose, plus the derived bird — or nakshatra, paksha, and
optionally the derived Moon sign. Account defaults may store language,
theme, default bird, and a default location you explicitly chose — that
location is **rounded to ~1 km before storage** (2 decimal places), the same
bound applied everywhere else a location is kept server-side. **Raw birth
date, time, and event-specific coordinates are never stored server-side,
signed in or not** (they're not even sent to the account endpoints). Who may
sign in is controlled by an explicit server-side allowlist.

Birth data and precise coordinates are never:

- Placed in a URL, query string, or path parameter.
- Written to application logs, even at debug level.
- Sent to any analytics or error-monitoring service.
- Used as, or embedded in, a cache key that's visible outside the server.

## What's stored in your browser

Language, theme, and the derived saved-profile choices you explicitly create
(label, bird or nakshatra/paksha, and optional Moon sign) remain ordinary
browser preferences. They never contain a raw birth date, birth time, or
precise location. The Privacy-page clear action removes them.

Raw birth details, selected/direct bird, precise recent locations, cached
schedules, live schedule requests, and derived identity seeds are sensitive
calculator state. They are stored only in the passphrase-protected local vault
using AES-GCM encryption; its derived key exists only in the current tab's
memory. Locking the vault clears those in-memory values and a new tab must be
unlocked again. The vault backup/download contains only encrypted ciphertext
and its salt—never the passphrase or plaintext—and can be restored only with
the original passphrase. Changing the passphrase re-encrypts the vault with a
new salt; download a fresh encrypted backup afterward. Older backup files still
need the former passphrase until you securely remove those copies.

The vault's encrypted ciphertext and salt remain in browser storage so the
user can unlock later. Use **Clear saved preferences** to remove both the
vault and the ordinary preferences from this browser.

## Location

If you use "Use my location," your device's coordinates are read by your
browser after you explicitly grant permission, and are resolved to a
timezone entirely on your device. To show you a readable place name instead
of a generic "Current location" label, those coordinates are also sent to
OpenStreetMap's Nominatim reverse-geocoding service — this only happens
after your explicit click, and only to look up a name for the coordinates
your browser already has; if that lookup fails or times out, the generic
label is shown instead and nothing else is affected. If you search for a
place by name instead, that search is sent to a third-party geocoding
service (Open-Meteo) to resolve it to coordinates — only the place name you
typed is sent, not any location your device has provided.

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

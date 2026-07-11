# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.
Use GitHub's private vulnerability reporting for this repository
(Security → Report a vulnerability), or contact the maintainer directly.

Please include: what you found, how to reproduce it, and its potential
impact. We'll acknowledge reports as soon as we can and keep you updated as
we work on a fix.

## Scope

This is a personal, low-traffic astrology site with no user accounts and no
server-side storage of birth data (see [`docs/privacy.md`](docs/privacy.md)).
Reports about the calculation engine's astrological accuracy are welcome as
regular issues, not security reports — security reports should be about
things like injection, auth bypass (none currently exists, so a report that
one is needed is itself interesting), information disclosure, or dependency
vulnerabilities.

## Supported versions

Only the latest `main` / most recent release is supported. There is no
long-term-support branch.

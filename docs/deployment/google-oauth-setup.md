# Enabling Google sign-in

Sign-in is entirely optional infrastructure and ships **switched off**: with
no OAuth credentials configured there is no sign-in button, `/api/auth/*`
returns 404, and the site behaves exactly as if accounts didn't exist.
Everything works anonymously with device-local storage regardless.

## 1. Create the OAuth client (Google Cloud Console, ~5 minutes)

1. Go to https://console.cloud.google.com/ and create (or pick) a project.
2. **APIs & Services → OAuth consent screen**: choose **External**, fill the
   app name ("Fernando Family Astrology"), support email, and developer
   contact; add no extra scopes (the defaults — openid, email, profile — are
   all that's used); publish the app (or keep it in Testing and add the
   allowlisted account as a test user).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://astrology.fernandofamily.com`
   - Authorized redirect URIs:
     `https://astrology.fernandofamily.com/api/auth/callback/google`
4. Copy the **Client ID** and **Client secret**.

## 2. Configure the server

In the deployment's `.env` (never committed):

```
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
AUTH_SECRET=<already generated — openssl rand -base64 32 if absent>
AUTH_ALLOWED_EMAILS=fernandonaveen2000@gmail.com
AUTH_URL=https://astrology.fernandofamily.com
ASTROLOGY_DATABASE_URL=<already configured>
```

`AUTH_ALLOWED_EMAILS` is the invite list: comma-separated Google account
emails. Anyone else completing the Google flow gets a friendly
"sign-in is invite-only" page and no session.

## 3. Activate

```bash
cd /home/ubuntu/workspace/projects/fernandofamily-astrology
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d web
```

No rebuild needed — the flag is evaluated at runtime (the account menu
probes the session endpoint, which stops 404ing once the env vars exist).
Verify: the nav shows "Sign in"; `curl -s https://astrology.fernandofamily.com/api/auth/providers`
returns the Google provider JSON instead of 404.

## Nginx note

The public nginx site must route `/api/auth/` and `/api/account/` to the
web service (port 3100) rather than the calculation API — see
`docs/deployment/dns-and-https.md`. Everything else under `/api/` continues
to go to FastAPI.

## What signing in changes (and what it doesn't)

- Signed-in users' saved profiles and preferences sync to the server
  (Postgres) so they follow you across devices. Only a label plus the
  derived bird — or nakshatra + paksha — is ever stored server-side;
  **never raw birth date, time, or coordinates** (see `docs/privacy.md`).
- Anonymous users keep full functionality with everything device-local.

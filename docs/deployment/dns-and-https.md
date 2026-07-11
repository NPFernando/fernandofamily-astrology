# DNS and HTTPS

## DNS

```
Type:  A
Name:  astrology
Value: <your server's public IPv4>
```

Optional IPv6:

```
Type:  AAAA
Name:  astrology
Value: <your server's public IPv6>
```

If you're behind a DNS proxy provider (e.g. Cloudflare's orange-cloud
proxying), disable proxying for this record while issuing the initial
Let's Encrypt certificate via the HTTP-01 webroot challenge described below —
proxying can interfere with the challenge unless you've separately configured
an origin certificate. Once the certificate is issued and auto-renewal is
working, whether to enable proxying afterward is a normal CDN/WAF decision,
not something this app requires either way.

## Reverse proxy

This app is designed to sit behind any reverse proxy that can:

- Terminate TLS.
- Forward `astrology.fernandofamily.com/api/*` to the API service, preserving
  the `/api` path prefix.
- Forward everything else to the web (Next.js) service.

A portable, batteries-included example is provided at
[`../../infra/caddy/Caddyfile`](../../infra/caddy/Caddyfile) for self-hosters
who don't already run a reverse proxy — Caddy handles certificate issuance
and renewal automatically.

If you already run nginx for other sites on the same host (as the reference
production deployment does), add a new site instead: a plain HTTP→HTTPS
redirect block (reusing your existing ACME webroot), and an HTTPS block that
proxies `/api/` to the API container's published port and `/` to the web
container's published port — both containers should be bound to loopback
only in production (see `docker-compose.production.yml`), with nginx as the
sole internet-facing edge. Give this site its own `limit_req_zone`/
`limit_conn_zone` names, distinct from any zones an existing site already
defines, to avoid silently sharing rate-limit state across unrelated
products on the same host.

## Certificate issuance (webroot method, nginx example)

1. Stand up a plain HTTP server block for the domain first, with
   `location /.well-known/acme-challenge/ { root /var/www/html; }` (or
   whatever webroot your ACME client is configured to use) and everything
   else redirecting to HTTPS.
2. `nginx -t` to validate, then reload (not restart) nginx.
3. `certbot certonly --webroot -w /var/www/html -d astrology.fernandofamily.com`
4. Add the full HTTPS server block referencing the issued certificate
   (`/etc/letsencrypt/live/astrology.fernandofamily.com/{fullchain,privkey}.pem`),
   `nginx -t` again, then reload.
5. Certbot's systemd timer (or cron job) handles renewal automatically —
   confirm with `certbot certificates` and `systemctl list-timers | grep certbot`.

## Verifying the deployment

- `curl -I http://astrology.fernandofamily.com/` — expect a `301` to HTTPS.
- `curl -I https://astrology.fernandofamily.com/` — expect a `200`/`307`
  (locale redirect) with `Strict-Transport-Security`, `X-Frame-Options`,
  `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`
  headers present.
- `curl https://astrology.fernandofamily.com/api/v1/health/ready` — expect a
  `200` with checksum/version/commit details, not a `5xx`.
- If the host serves other domains already, re-check those too after any
  nginx config change (`curl -I` each one) — a syntactically valid config
  can still silently change behavior for an unrelated `server_name` block if
  directives were placed in the wrong scope.

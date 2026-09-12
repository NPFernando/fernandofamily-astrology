# Production monitoring

The monitoring profile collects only the API's existing aggregate metrics and
probes the public HTTPS edge. Route templates, status codes, durations, and
probe success/TLS timing are exported; request bodies, query values, birth
details, and locations are not. Prometheus, Alertmanager, and Grafana are
bound to loopback only and are never added to the public nginx site. The
Blackbox exporter has no published port and is reachable only by Prometheus on
the Compose network.

## Enable the profile

On the production host, create two distinct secret files. Do not put either
value in `.env`, shell history, or the repository.

```bash
cd /home/ubuntu/workspace/projects/fernandofamily-astrology
install -d -m 700 .monitoring
umask 077
read -rsp 'Grafana admin password: ' value; printf '\n'; printf '%s' "$value" > .monitoring/grafana-admin-password; unset value
read -rsp 'HTTPS alert webhook URL: ' value; printf '\n'; printf '%s' "$value" > .monitoring/alert-webhook-url; unset value
chmod 600 .monitoring/grafana-admin-password .monitoring/alert-webhook-url
```

The webhook must accept Alertmanager's generic JSON webhook payload and use
HTTPS. Set the following in the production `.env`:

```dotenv
MONITORING_ENABLED=1
GRAFANA_ADMIN_PASSWORD_FILE=.monitoring/grafana-admin-password
ALERT_WEBHOOK_URL_FILE=.monitoring/alert-webhook-url
GRAFANA_ROOT_URL=http://127.0.0.1:3200
```

The next normal CI-approved deploy starts the profile. To start it manually
after a secret rotation, run:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml --profile monitoring up -d
```

Use an SSH tunnel rather than exposing the UIs through nginx:

```bash
ssh -L 3200:127.0.0.1:3200 -L 9090:127.0.0.1:9090 -L 9093:127.0.0.1:9093 <production-host>
```

Then open Grafana at `http://127.0.0.1:3200`. The provisioned **Fernando
Family Astrology — Production** dashboard is read-only and uses the local
Prometheus source. Prometheus is available at port 9090 for target/alert
inspection; Alertmanager is port 9093 for silences and delivery diagnostics.

## Alerts and first response

| Alert | Condition | First response |
| --- | --- | --- |
| `AstrologyApiDown` | API scrape unavailable for 2 minutes | [API down](#api-down) |
| `PublicHttpsEndpointDown` | Public `/en` or readiness endpoint fails for 2 minutes | [Public HTTPS endpoint down](#public-https-endpoint-down) |
| `PublicHttpsCertificateExpiringSoon` | Public TLS certificate has under 14 days remaining | [Public HTTPS certificate expiring](#public-https-certificate-expiring) |
| `AstrologyApiServerErrors` | 5xx ratio exceeds 5% for 10 minutes | [Server errors](#server-errors) |
| `AstrologyApiRateLimited` | More than 3 rate-limited requests/minute for 10 minutes | [Rate limits](#rate-limits) |
| `AstrologyApiSlowResponses` | API p95 exceeds 1 second for 10 minutes | [Slow responses](#slow-responses) |
| `PushDispatchFailures` | Internal push dispatch returns a 5xx for 15 minutes | [Push dispatch failures](#push-dispatch-failures) |

### API down

Check the exact image and application state before changing anything:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
curl -fsS http://127.0.0.1:8100/api/v1/health/ready
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=200 api
```

If the API does not become ready, use the documented rollback procedure; do
not restart unrelated host services.

### Public HTTPS endpoint down

The Blackbox probe requests the public `/en` and `/api/v1/health/ready` URLs
with strict certificate validation, no redirects, and a required `200` status.
It therefore catches public DNS resolution, TCP connection, TLS, proxy, and
unexpected-status failures that a Compose-network API scrape cannot see.

First compare it with the local release smoke checks. If the local API and web
checks are healthy, inspect the public DNS, certificate, and reverse-proxy
configuration before rolling back the application. Use an independent network
for a one-off confirmation and do not put user-specific URLs in incident
notes:

```bash
curl --fail --silent --show-error --max-time 20 https://astrology.fernandofamily.com/en -o /dev/null
curl --fail --silent --show-error --max-time 20 https://astrology.fernandofamily.com/api/v1/health/ready -o /dev/null
```

The repository's `public-smoke.yml` workflow performs the same exact-200
checks hourly from a GitHub-hosted runner. Its failure is independent of the
production host's local network; review the failed workflow before treating a
host-side probe as a full internet outage.

### Public HTTPS certificate expiring

Confirm the currently served certificate expiry and renew through the existing
ACME/Caddy or nginx/certbot procedure. Do not disable certificate validation,
weaken this alert, or restart application containers as a certificate-renewal
shortcut. After renewal, wait for the next scrape and confirm the dashboard's
certificate-days panel recovers.

### Server errors

Inspect the dashboard panel by route/status, then correlate a sampled request
ID with the API logs. Never paste request bodies, URLs containing user data,
or raw error traces into alert systems. If errors began with a release, use
the image tag recorded in `.last-good-tag` and follow the rollback guide.

### Rate limits

Use the request-rate panel to identify whether the pressure is broad or
concentrated. Check reverse-proxy forwarding and rate-limit configuration
before raising limits; do not disable rate limiting as an incident shortcut.

### Slow responses

Compare p95 latency with 5xx and request-rate panels. Confirm readiness and
container resource pressure, then inspect only aggregate route metrics and
request IDs. Roll back a correlated release rather than changing engine data
or vendor files during an incident.

### Push dispatch failures

Check the loopback-only dispatch cron and the last API request ID. Verify the
VAPID configuration and database connectivity without printing their values:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml logs --tail=200 web
tail -200 .push-dispatch.log
```

## Secret rotation and disablement

Replace one secret file atomically with mode `0600`, then restart only the
affected monitoring service. Rotate the Grafana password after changing the
file; Alertmanager reloads only after a container restart. To stop the stack,
set `MONITORING_ENABLED=0` and run a normal deploy, or explicitly stop the
four monitoring services. Their named volumes intentionally retain history
until an operator decides to remove them.

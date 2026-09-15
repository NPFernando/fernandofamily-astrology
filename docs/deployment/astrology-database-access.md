# Astrology database access and migration runbook

This covers the web container's connection to host PostgreSQL database
`astrology`. The web app does **not** apply schema DDL at startup. Host
networking, the login role, and schema upgrades are separate, explicit
operator steps. PostgreSQL may also serve other local databases, so plan a
brief maintenance window before restarting the cluster.

## Preflight and change plan

From the deployed checkout, run the read-only check:

```sh
infra/deploy/astrology-db-preflight.sh
```

It checks the running web container, Compose subnet and host alias, listener,
UFW rule, `pg_hba.conf` rule, SCRAM role, table grants, migration columns and
constraints, and a real connection from the web container. It suppresses
connection errors and never prints the database URL. A nonzero exit means
stop and investigate; do not widen the firewall or use `trust` authentication.

Review the migration plan and hashes before applying schema changes:

```sh
infra/deploy/astrology-db-apply-migrations.sh
```

Before any DDL, follow [`database-backups.md`](database-backups.md) and confirm
a recent backup/restore point. The explicit apply command requires both a
database-name confirmation and the backup acknowledgement:

```sh
infra/deploy/astrology-db-apply-migrations.sh --apply --confirm astrology --backup-verified
```

The helper applies only migrations `003_push_quiet_hours.sql` and
`004_push_alert_rules.sql`, in one transaction, then verifies their columns
and constraints. It is not called by Docker, the app entrypoint, or the normal
image deployment.

## Provision the app role

The web container must be running with `ASTROLOGY_DATABASE_URL` configured for
`host.docker.internal`, database `astrology`, and role `astrology_app`. The
role helper obtains the password inside the container and streams SQL to local
PostgreSQL; it never prints the URL or password. Run it only after reviewing
the target and grants:

```sh
infra/deploy/astrology-db-ensure-role.sh --apply --confirm astrology_app@astrology
```

The role is not a superuser or database owner. It receives `CONNECT`, schema
`USAGE`, and CRUD on `profiles`, `preferences`, `push_subscriptions`, and
`push_sent` only. `pg_hba.conf` further limits container connections to that
role and the `astrology` database.

## Host network change

1. Identify the web container's Docker subnet and the IPv4 address to which
   `host.docker.internal` resolves. Do not assume these addresses match on
   another host:

   ```sh
   ASTROLOGY_DOCKER_NETWORK=fernandofamily-astrology_default
   ASTROLOGY_WEB_CONTAINER=fernandofamily-astrology-web-1
   export ASTROLOGY_DOCKER_NETWORK ASTROLOGY_WEB_CONTAINER
   ASTROLOGY_NETWORK_SUBNET="$(docker network inspect "$ASTROLOGY_DOCKER_NETWORK" \
     --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')"
   ASTROLOGY_HOST_ALIAS_IP="$(docker exec "$ASTROLOGY_WEB_CONTAINER" node -e \
     'require("node:dns").lookup("host.docker.internal", (_error, address) => process.stdout.write(address))')"
   printf 'subnet=%s host-alias-ip=%s\n' "$ASTROLOGY_NETWORK_SUBNET" "$ASTROLOGY_HOST_ALIAS_IP"
   ```

2. Check `pg_stat_activity` for active transactions and dependent local
   services. Restarting PostgreSQL briefly disconnects every database on that
   cluster, including the separate Hermes queue database.
3. Back up the config files to a root-only, timestamped directory before
   editing, and record the current firewall rules:

   ```sh
   ASTROLOGY_DB_CONFIG_BACKUP="/var/backups/astrology-db-access/$(date -u +%Y%m%dT%H%M%SZ)"
   sudo install -d -o root -g root -m 700 "$ASTROLOGY_DB_CONFIG_BACKUP"
   sudo cp --preserve=mode,ownership,timestamps /etc/postgresql/16/main/postgresql.conf "$ASTROLOGY_DB_CONFIG_BACKUP/"
   sudo cp --preserve=mode,ownership,timestamps /etc/postgresql/16/main/pg_hba.conf "$ASTROLOGY_DB_CONFIG_BACKUP/"
   sudo ufw status numbered | sudo tee "$ASTROLOGY_DB_CONFIG_BACKUP/ufw-status.txt" >/dev/null
   ```

4. Set `listen_addresses` to `localhost` plus only the resolved host address
   (not `*`, `0.0.0.0`, or a public interface). Add exactly one HBA record
   using the literal CIDR printed in `$ASTROLOGY_NETWORK_SUBNET`, before any
   broader matching record (do not put the shell variable itself in `pg_hba.conf`):

   ```text
   host    astrology    astrology_app    <literal-compose-subnet-cidr>    scram-sha-256
   ```

5. Add a matching firewall rule targeting the resolved host address and
   sourcing only the Compose subnet. Remove any obsolete broader rule for that
   same destination/port; do not allow `Anywhere`:

   ```sh
   if ! sudo ufw status | grep -F "$ASTROLOGY_HOST_ALIAS_IP 5432/tcp" | grep -Fq "$ASTROLOGY_NETWORK_SUBNET"; then
     sudo ufw allow from "$ASTROLOGY_NETWORK_SUBNET" to "$ASTROLOGY_HOST_ALIAS_IP" port 5432 proto tcp comment 'Astrology Compose app to host PostgreSQL'
   fi
   ```

6. Before restarting, validate the HBA parser and effective bind setting:

   ```sh
   sudo -u postgres psql -XAtqc \
     "SELECT count(*) FROM pg_hba_file_rules WHERE error IS NOT NULL" postgres
   sudo -u postgres /usr/lib/postgresql/16/bin/postgres -C listen_addresses \
     -c config_file=/etc/postgresql/16/main/postgresql.conf
   ```

   The first command must print `0`. Apply/verify the role and approved
   migrations while local socket access is healthy, then restart once:

   ```sh
   sudo pg_ctlcluster 16 main restart
   sudo pg_ctlcluster 16 main status
   infra/deploy/astrology-db-preflight.sh
   ```

   Do not declare success unless the preflight passes and dependent local
   services have reconnected.

## Rollback

If restart or app connection fails, restore the saved files, remove only the
new UFW allow rule, remove the specific astrology HBA record, and restart
PostgreSQL:

```sh
sudo cp --preserve=mode,ownership,timestamps "$ASTROLOGY_DB_CONFIG_BACKUP/postgresql.conf" /etc/postgresql/16/main/postgresql.conf
sudo cp --preserve=mode,ownership,timestamps "$ASTROLOGY_DB_CONFIG_BACKUP/pg_hba.conf" /etc/postgresql/16/main/pg_hba.conf
sudo ufw --force delete allow from "$ASTROLOGY_NETWORK_SUBNET" to "$ASTROLOGY_HOST_ALIAS_IP" port 5432 proto tcp
sudo pg_ctlcluster 16 main restart
sudo pg_isready
sudo pg_ctlcluster 16 main status
```

Then inspect cluster logs, verify dependent services, and confirm the public
app shell still responds. The app preflight is expected to fail after network
access is rolled back; DB-backed account features will be unavailable.

Do **not** automatically drop `astrology_app` or remove migration columns as
part of network rollback. The role is inert without the scoped HBA/firewall
path, and migration `004` adds preference columns that may later contain
data. Schema reversal requires a fresh verified backup, proof the fields are
unused, and a separately reviewed recovery decision. Production data restore
is governed by [`database-backups.md`](database-backups.md), not image
rollback.

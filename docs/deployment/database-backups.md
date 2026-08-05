# PostgreSQL backup and restore drills

The account/profile and web-push tables are the only server-side application
data. They deliberately exclude raw birth dates, times, and precise
coordinates, but still contain account emails, preference data, and push
subscription credentials. Treat every database archive as confidential.

`infra/deploy/database-backup.sh` creates PostgreSQL custom-format archives,
parses each archive with `pg_restore --list` before publishing it, gives the
archive mode `0600`, and retains only generated archives in its configured
directory. `infra/deploy/database-restore-drill.sh` restores the newest (or a
named) archive into a dedicated disposable database, then verifies the four
application tables. It refuses to use the production database or a database
whose name does not begin with `astrology_restore_`.

`infra/deploy/database-offsite-backup.sh` then encrypts that verified archive
with [Restic](https://restic.net/) and replicates it to an operator-selected
repository. The companion off-site drill restores the latest encrypted copy
to a temporary directory before applying the same isolated database check.
This protects against host or local-disk loss as well as application failure.

## One-time host setup

Install PostgreSQL client tools and Restic, then create a **separate
disposable database** owned by the role that will run the drill. Do not use
the production database, and do not grant the application container any new
privileges merely for this operation.

```bash
sudo apt-get install postgresql-client restic
sudo install -d -o ubuntu -g ubuntu -m 700 /var/backups/fernandofamily-astrology/postgres
sudo install -d -o ubuntu -g ubuntu -m 700 /var/cache/fernandofamily-astrology/restic
sudo install -d -o root -g ubuntu -m 750 /etc/fernandofamily-astrology
sudo install -o root -g ubuntu -m 640 /dev/null /etc/fernandofamily-astrology/database-backup.env
sudoedit /etc/fernandofamily-astrology/database-backup.env
```

The root-owned environment file must have mode `0640` and contain only these
DSNs (plus optional retention configuration). Never commit it, add it to the
project `.env`, print it to a terminal, or paste it into an incident ticket.

```dotenv
ASTROLOGY_DATABASE_URL=postgresql://<backup-role>:<password>@<host>:5432/astrology
RESTORE_DRILL_DATABASE_URL=postgresql://<backup-role>:<password>@<host>:5432/astrology_restore_drill
ASTROLOGY_BACKUP_RETENTION_DAYS=14
RESTIC_REPOSITORY=s3:https://<provider-endpoint>/<bucket>/fernandofamily-astrology
RESTIC_PASSWORD_FILE=/etc/fernandofamily-astrology/restic-password
RESTIC_DATABASE_BACKUP_TAG=fernandofamily-astrology-postgres
```

The backup role needs read access to the application tables. The restore role
must own the disposable `astrology_restore_drill` database and be able to
create/drop the application objects inside it. Use a distinct role from the
web runtime if those permissions differ.

Initialize the empty Restic repository once from a restricted administrator
session, after configuring the provider's own credentials in the same
root-owned environment file (for example, an S3-compatible access key). Store
the independent Restic password in the `RESTIC_PASSWORD_FILE` above with mode
`0600`; it is not interchangeable with the database password. Do not select
or initialize a bucket from this repository—the object-storage account,
region, retention/legal requirements, and credentials belong to the operator.

Install the checked-in timers, then verify both scheduled units before relying
on them:

```bash
cd /home/ubuntu/workspace/projects/fernandofamily-astrology
sudo install -m 0644 infra/deploy/systemd/fernandofamily-db-*.service /etc/systemd/system/
sudo install -m 0644 infra/deploy/systemd/fernandofamily-db-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now \
  fernandofamily-db-backup.timer \
  fernandofamily-db-restore-drill.timer \
  fernandofamily-db-offsite-backup.timer \
  fernandofamily-db-offsite-restore-drill.timer
sudo systemctl start fernandofamily-db-backup.service
sudo systemctl start fernandofamily-db-restore-drill.service
sudo systemctl start fernandofamily-db-offsite-backup.service
sudo systemctl start fernandofamily-db-offsite-restore-drill.service
systemctl list-timers 'fernandofamily-db-*'
```

The backup timer runs daily with a short randomized delay; the restore drill
runs on the first Sunday of each month with a longer randomized delay. The
restore unit intentionally replaces the disposable database's contents. A
failed drill is an operational incident: do not silence it or call the backup
healthy until a restore succeeds.

The off-site timer runs after the local backup and retains only snapshots with
the dedicated application tag (14 daily, 8 weekly, and 12 monthly by default)
before pruning unreachable repository data. Its monthly restore drill proves
that the encrypted remote archive can be downloaded and restored into the
disposable database. Restic's tagged retention and `latest` restore behavior
follow its documented [forget](https://restic.readthedocs.io/en/stable/060_forget.html)
and [restore](https://restic.readthedocs.io/en/stable/050_restore.html) flows.

## Manual use and recovery

For a manual backup or drill, export the same environment variables only in a
restricted shell/session, then run the script from the repository root. The
scripts never log the DSN or archive contents.

```bash
bash infra/deploy/database-backup.sh
bash infra/deploy/database-restore-drill.sh
bash infra/deploy/database-offsite-backup.sh
bash infra/deploy/database-offsite-restore-drill.sh
```

To inspect an archive without exposing row data, use only its table of
contents:

```bash
pg_restore --list /var/backups/fernandofamily-astrology/postgres/astrology-<timestamp>.dump
```

Production recovery is a deliberate, separately approved incident action. Do
not point the drill script at production. Instead, stop writes, take a fresh
safety backup, have two operators review the exact destination database and
archive, then restore with `pg_restore --clean --if-exists --no-owner
--no-privileges` through a controlled runbook. Record only archive filename,
timestamp, and destination database in incident notes—never connection URLs,
rows, endpoints, or credentials.

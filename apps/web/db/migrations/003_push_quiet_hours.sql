-- Optional subscriber-local quiet hours. The dispatcher evaluates these in
-- the stored IANA timezone; no raw birth data or more precise location is
-- added to the notification record.
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS quiet_start_hour int,
  ADD COLUMN IF NOT EXISTS quiet_end_hour int;

ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_quiet_hours_valid;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_quiet_hours_valid CHECK (
    (quiet_start_hour IS NULL AND quiet_end_hour IS NULL)
    OR (
      quiet_start_hour BETWEEN 0 AND 23
      AND quiet_end_hour BETWEEN 0 AND 23
      AND quiet_start_hour <> quiet_end_hour
    )
  );

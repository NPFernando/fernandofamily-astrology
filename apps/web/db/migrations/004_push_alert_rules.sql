-- Subscriber-local alert frequency rules. Values are evaluated in each
-- subscription's stored IANA timezone and do not add any personal fields.
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS allowed_weekdays smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,7],
  ADD COLUMN IF NOT EXISTS max_alerts_per_day int NOT NULL DEFAULT 3;

ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_allowed_weekdays_valid,
  DROP CONSTRAINT IF EXISTS push_max_alerts_per_day_valid;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_allowed_weekdays_valid CHECK (
    cardinality(allowed_weekdays) BETWEEN 1 AND 7
    AND allowed_weekdays <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
  ),
  ADD CONSTRAINT push_max_alerts_per_day_valid CHECK (max_alerts_per_day BETWEEN 1 AND 5);

-- Web-push notification subscriptions — no login required to subscribe.
--
-- Privacy: coordinates are rounded to 2 decimals (~1km) BEFORE storage by
-- the subscribe route (and the columns can't hold more precision), and only
-- the derived bird or (nakshatra, paksha) identity is kept — never raw
-- birth date/time. See docs/privacy.md.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  bird text,
  nakshatra_index int,
  paksha text,
  latitude numeric(5,2) NOT NULL,
  longitude numeric(5,2) NOT NULL,
  iana_tz text NOT NULL,
  min_effect text NOT NULL DEFAULT 'very_good',
  lead_minutes int NOT NULL DEFAULT 10,
  locale text NOT NULL DEFAULT 'si',
  failures int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_bird_valid CHECK (
    bird IS NULL OR bird IN ('vulture', 'owl', 'crow', 'cock', 'peacock')
  ),
  CONSTRAINT push_paksha_valid CHECK (
    paksha IS NULL OR paksha IN ('waxing', 'waning')
  ),
  CONSTRAINT push_nakshatra_valid CHECK (
    nakshatra_index IS NULL OR (nakshatra_index BETWEEN 1 AND 27)
  ),
  CONSTRAINT push_bird_or_nakshatra CHECK (
    bird IS NOT NULL OR (nakshatra_index IS NOT NULL AND paksha IS NOT NULL)
  ),
  CONSTRAINT push_min_effect_valid CHECK (min_effect IN ('good', 'very_good')),
  CONSTRAINT push_lead_valid CHECK (lead_minutes BETWEEN 5 AND 60),
  CONSTRAINT push_locale_valid CHECK (locale IN ('en', 'si')),
  CONSTRAINT push_lat_valid CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT push_lon_valid CHECK (longitude BETWEEN -180 AND 180)
);

-- Dedup log: a (subscription, window) pair is notified at most once.
-- Dispatch prunes rows older than 2 days on each run.
CREATE TABLE IF NOT EXISTS push_sent (
  endpoint text NOT NULL,
  window_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (endpoint, window_key)
);

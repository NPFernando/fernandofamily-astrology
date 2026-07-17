-- Astrology account data — profiles + preferences for signed-in users.
--
-- Deliberately NO raw birth date/time/coordinates columns anywhere here:
-- even for logged-in users the server stores only the *derived* bird or
-- (nakshatra, paksha, optional Moon rashi). See docs/privacy.md.

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  label text NOT NULL,
  bird text,
  nakshatra_index int,
  paksha text,
  moon_rashi_index int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_bird_valid CHECK (
    bird IS NULL OR bird IN ('vulture', 'owl', 'crow', 'cock', 'peacock')
  ),
  CONSTRAINT profiles_paksha_valid CHECK (
    paksha IS NULL OR paksha IN ('waxing', 'waning')
  ),
  CONSTRAINT profiles_nakshatra_valid CHECK (
    nakshatra_index IS NULL OR (nakshatra_index BETWEEN 1 AND 27)
  ),
  CONSTRAINT profiles_moon_rashi_valid CHECK (
    moon_rashi_index IS NULL OR (moon_rashi_index BETWEEN 1 AND 12)
  ),
  -- A profile must identify a bird somehow: directly, or derivably.
  CONSTRAINT profiles_bird_or_nakshatra CHECK (
    bird IS NOT NULL OR (nakshatra_index IS NOT NULL AND paksha IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS profiles_owner_idx ON profiles (owner_email);

CREATE TABLE IF NOT EXISTS preferences (
  owner_email text PRIMARY KEY,
  locale text,
  theme text,
  default_bird text,
  default_location jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferences_bird_valid CHECK (
    default_bird IS NULL OR default_bird IN ('vulture', 'owl', 'crow', 'cock', 'peacock')
  )
);

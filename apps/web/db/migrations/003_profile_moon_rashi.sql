-- Store only the derived natal Moon rashi index (1..12), never raw birth
-- date/time/location. This lets saved known-Nakshatra profiles power
-- Chandrashtama in the Daily Guide.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS moon_rashi_index int;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_moon_rashi_valid'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_moon_rashi_valid
      CHECK (moon_rashi_index IS NULL OR (moon_rashi_index BETWEEN 1 AND 12));
  END IF;
END $$;

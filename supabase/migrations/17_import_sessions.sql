-- Import session tracking: Airbnb/Booking.com listing import folyamat
-- Jövőbeni integráció: channel manager API-kkal

CREATE TYPE IF NOT EXISTS import_platform AS ENUM (
  'airbnb', 'booking_com', 'vrbo', 'turo', 'holidu', 'rentalcars', 'other'
);

CREATE TYPE IF NOT EXISTS import_status AS ENUM (
  'pending', 'processing', 'completed', 'failed', 'cancelled'
);

CREATE TABLE IF NOT EXISTS public.import_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform import_platform NOT NULL,
  platform_url TEXT,           -- A beküldött listing URL
  platform_listing_id TEXT,    -- External platform ID (ha elérhető)
  status import_status DEFAULT 'pending',
  raw_data JSONB,              -- Platform-tól visszakapott nyers adat
  parsed_data JSONB,           -- Feldolgozott, Rentivo-kompatibilis adat
  error_message TEXT,
  listing_id UUID REFERENCES public.listings(id), -- Létrehozott listing (ha sikeres)
  ical_url TEXT,               -- iCal sync URL (ha van)
  -- Jövőbeni: channel manager szinkronizáláshoz
  channel_manager_id TEXT,     -- Hostaway/RentalsUnited listing ID
  last_synced_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexek
CREATE INDEX IF NOT EXISTS idx_import_sessions_user_id
  ON public.import_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_status
  ON public.import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_import_sessions_platform
  ON public.import_sessions(platform);

-- RLS
ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own import sessions" ON public.import_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create own import sessions" ON public.import_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own import sessions" ON public.import_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_import_sessions_updated_at
  BEFORE UPDATE ON public.import_sessions
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

COMMENT ON TABLE public.import_sessions IS
  'Listing import session tracking. Phase 1: manuális URL import.
   Jövőbeni kapuk:
   - channel_manager_id: Hostaway/RentalsUnited integráció
   - ical_url: automatikus naptár szinkron
   - sync_enabled: kétirányú szinkronizálás';

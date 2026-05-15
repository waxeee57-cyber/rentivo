-- Connected external platforms (iCal sync)
-- Column names match types/index.ts PlatformConnection interface
CREATE TABLE IF NOT EXISTS public.rentivo_connected_platforms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES public.rentivo_listings(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  ical_url TEXT,
  external_url TEXT,
  active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- Jövőbeni kapuk:
  -- channel_manager_id TEXT,          -- Hostaway/RentalsUnited listing ID
  -- channel_manager_listing_id TEXT,  -- kétirányú szinkron
);

CREATE INDEX IF NOT EXISTS idx_connected_platforms_owner_id
  ON public.rentivo_connected_platforms(owner_id);
CREATE INDEX IF NOT EXISTS idx_connected_platforms_listing_id
  ON public.rentivo_connected_platforms(listing_id);

ALTER TABLE public.rentivo_connected_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own connected platforms" ON public.rentivo_connected_platforms
  FOR ALL USING (auth.uid() = owner_id);

COMMENT ON TABLE public.rentivo_connected_platforms IS
  'Kapcsolt platformok iCal sync-hez. Jövőbeni kapuk: Nylas calendar API, Hostaway channel manager';

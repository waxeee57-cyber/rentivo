-- Listings (vehicles, villas, boats, etc.)
-- Column names match types/index.ts Listing interface exactly
-- host_id and owner_type added later by 08_c2c.sql
CREATE TABLE IF NOT EXISTS public.rentivo_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operator_id UUID REFERENCES public.rentivo_operators(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'car',
  subcategory TEXT,
  price_per_day DECIMAL(10,2) NOT NULL,
  price_per_week DECIMAL(10,2),
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  available BOOLEAN DEFAULT true,
  min_rental_days INTEGER DEFAULT 1,
  max_rental_days INTEGER,
  capacity INTEGER,
  year INTEGER,
  make TEXT,
  model TEXT,
  color TEXT,
  license_plate TEXT,
  features TEXT[] DEFAULT ARRAY[]::TEXT[],
  rules TEXT,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  cover_image_url TEXT,
  cancellation_policy TEXT DEFAULT 'moderate'
    CHECK (cancellation_policy IN ('flexible','moderate','strict')),
  pickup_address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  booking_count INTEGER DEFAULT 0,
  instant_book BOOLEAN DEFAULT false,
  is_external BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentivo_listings_operator_id ON public.rentivo_listings(operator_id);
CREATE INDEX IF NOT EXISTS idx_rentivo_listings_category ON public.rentivo_listings(category);
CREATE INDEX IF NOT EXISTS idx_rentivo_listings_available ON public.rentivo_listings(available);
CREATE INDEX IF NOT EXISTS idx_rentivo_listings_price ON public.rentivo_listings(price_per_day);

ALTER TABLE public.rentivo_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available listings" ON public.rentivo_listings
  FOR SELECT USING (available = true);

CREATE POLICY "Owners see own listings" ON public.rentivo_listings
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners manage own listings" ON public.rentivo_listings
  FOR ALL USING (auth.uid() = owner_user_id);

CREATE TRIGGER update_rentivo_listings_updated_at
  BEFORE UPDATE ON public.rentivo_listings
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.rentivo_listings IS
  'Listings. available=true is the live gate (not status enum).
   host_id + owner_type added by 08_c2c.sql.
   Jövőbeni kapuk: video_url (HeyGen), channel_manager_id (Hostaway)';

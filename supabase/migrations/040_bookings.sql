-- Bookings — must run before 04_chat.sql (which references rentivo_bookings)
-- Column names match types/index.ts Booking interface exactly
-- host_id + owner_type added later by 08_c2c.sql
CREATE TABLE IF NOT EXISTS public.rentivo_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES public.rentivo_listings(id) ON DELETE RESTRICT NOT NULL,
  operator_id UUID REFERENCES public.rentivo_operators(id),
  user_id UUID REFERENCES auth.users(id),
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  guest_phone TEXT,
  guest_nationality TEXT,
  driver_license_no TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER,
  pickup_time TEXT,
  return_time TEXT,
  pickup_location TEXT,
  price_per_day DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','active','completed','cancelled','disputed')),
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  contract_signed_at TIMESTAMPTZ,
  contract_url TEXT,
  consumer_signature TEXT,
  operator_signature TEXT,
  pickup_damage_done BOOLEAN DEFAULT false,
  return_damage_done BOOLEAN DEFAULT false,
  has_damage_claim BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rentivo_bookings_listing_id ON public.rentivo_bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_rentivo_bookings_user_id ON public.rentivo_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_rentivo_bookings_operator_id ON public.rentivo_bookings(operator_id);
CREATE INDEX IF NOT EXISTS idx_rentivo_bookings_status ON public.rentivo_bookings(status);
CREATE INDEX IF NOT EXISTS idx_rentivo_bookings_dates ON public.rentivo_bookings(start_date, end_date);

ALTER TABLE public.rentivo_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travelers see own bookings" ON public.rentivo_bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Operators see own listing bookings" ON public.rentivo_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rentivo_operators
      WHERE id = rentivo_bookings.operator_id AND auth_id = auth.uid()
    )
  );

CREATE POLICY "Travelers create bookings" ON public.rentivo_bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Booking parties update status" ON public.rentivo_bookings
  FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.rentivo_operators
      WHERE id = rentivo_bookings.operator_id AND auth_id = auth.uid()
    )
  );

CREATE TRIGGER update_rentivo_bookings_updated_at
  BEFORE UPDATE ON public.rentivo_bookings
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

COMMENT ON TABLE public.rentivo_bookings IS
  'Bookings. payment_intent_id for Stripe. host_id + owner_type added by 08_c2c.sql.
   Jövőbeni kapu: instant_payout_id (Stripe Instant Pay)';
